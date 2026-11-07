import { supabaseAdmin } from "@/src/lib/supabaseAdmin";
import { isDuplicateMessage, trackTokenUsage } from "@/src/lib/redis";
import { parseTransactionWithGemini, GeminiResult } from "@/src/lib/gemini";
import { appendTransactionToSheet } from "@/src/lib/sheets";
import {
	ratelimit,
	containsPromptInjection,
	sanitizeInputText,
} from "@/src/lib/security";
import { runWithChatAction, withSessionLock } from "../helpers/chatActions";
import { formatTransactionNotification } from "../helpers/formatters";
import { handleUserError, AppError } from "../helpers/errors";

// KONSTANTA BATAS UKURAN FILE (UNTUK MENJAGA LATENSI & VERCEL TIMEOUT)
const MAX_PHOTO_SIZE = 4 * 1024 * 1024; // 4 MB
const MAX_DOC_SIZE = 3 * 1024 * 1024; // 3 MB

async function fetchWithRetry(
	url: string,
	retries = 3,
	delayMs = 1000,
): Promise<Response> {
	for (let i = 0; i < retries; i++) {
		try {
			const res = await fetch(url);
			if (res.ok) return res;
		} catch (err) {
			if (i === retries - 1) throw err;
			await new Promise((r) => setTimeout(r, delayMs));
		}
	}
	throw new AppError(
		"⚠️ Gagal mengunduh file dari Telegram. Silakan coba kirim ulang.",
	);
}

export async function handleIncomingMessage(ctx: any) {
	const chatId = ctx.chat.id;
	const updateId = ctx.update.update_id;

	const { success } = await ratelimit.limit(`chat_${chatId}`);
	if (!success) {
		return ctx.reply(
			"⚠️ Anda mengirim pesan terlalu cepat. Harap tunggu 1 menit.",
		);
	}

	const duplicate = await isDuplicateMessage(updateId);
	if (duplicate) return;

	await withSessionLock(ctx, async () => {
		try {
			const { data: user } = await supabaseAdmin
				.from("users")
				.select("*")
				.eq("telegram_chat_id", chatId)
				.single();

			const isRegistered = !!(
				user &&
				user.refresh_token &&
				user.spreadsheet_id
			);

			let geminiResult: GeminiResult;

			if (ctx.message.photo) {
				const photos = ctx.message.photo;
				const largestPhoto = photos[photos.length - 1]; // Resolusi tertinggi

				// Validasi Ukuran Foto Maksimal 4 MB
				if (largestPhoto.file_size && largestPhoto.file_size > MAX_PHOTO_SIZE) {
					return ctx.reply(
						"⚠️ Ukuran foto terlalu besar. Harap kirimkan foto struk di bawah 4 MB.",
					);
				}

				geminiResult = await runWithChatAction(
					ctx,
					"upload_photo",
					async () => {
						const file = await ctx.getFile();
						const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
						const response = await fetchWithRetry(fileUrl);
						const arrayBuffer = await response.arrayBuffer();
						const base64Image = Buffer.from(arrayBuffer).toString("base64");

						return await parseTransactionWithGemini({
							inlineData: { mimeType: "image/jpeg", data: base64Image },
						});
					},
				);
			} else if (ctx.message.document) {
				const doc = ctx.message.document;

				// Validasi Ukuran Dokumen PDF Maksimal 3 MB
				if (doc.file_size && doc.file_size > MAX_DOC_SIZE) {
					return ctx.reply(
						"⚠️ Ukuran dokumen terlalu besar. Harap unggah file PDF mutasi di bawah 3 MB.",
					);
				}

				geminiResult = await runWithChatAction(
					ctx,
					"upload_document",
					async () => {
						const mimeType = doc.mime_type || "application/pdf";
						const file = await ctx.getFile();
						const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
						const response = await fetchWithRetry(fileUrl);
						const arrayBuffer = await response.arrayBuffer();
						const base64Data = Buffer.from(arrayBuffer).toString("base64");

						return await parseTransactionWithGemini({
							inlineData: { mimeType, data: base64Data },
						});
					},
				);
			} else if (ctx.message.text) {
				const sanitizedText = sanitizeInputText(ctx.message.text);
				if (containsPromptInjection(sanitizedText)) {
					return ctx.reply(
						"Maaf, saya adalah asisten keuangan pribadi Anda. Saya tidak dapat memberikan informasi teknis sistem atau menjalankan perintah di luar pencatatan keuangan.",
					);
				}

				geminiResult = await runWithChatAction(ctx, "typing", async () => {
					return await parseTransactionWithGemini(sanitizedText);
				});
			} else {
				return;
			}

			const parsed = geminiResult.data;
			const usage = geminiResult.usage;

			// CATAT DETAIL TOKEN KE REDIS (BERLAKU UNTUK GUEST & REGISTERED USER)
			if (usage && usage.totalTokens > 0) {
				await trackTokenUsage(chatId, usage);
			}

			// PENANGANAN OUT-OF-TOPIC (OOT)
			if (parsed.is_oot) {
				if (isRegistered) {
					const registeredOotMsg =
						`Halo! Saya adalah Asisten Keuangan AI Anda. 👋\n\n` +
						`🟢 <b>Akun Google Anda terhubung!</b> Sistem akan otomatis memindai email transaksi Gmail Anda setiap 1 jam sekali.\n\n` +
						`💡 Anda juga bisa langsung mengirimkan <b>teks catatan transaksi</b>, <b>foto struk</b>, atau <b>file mutasi</b> di sini kapan saja untuk dicatat otomatis ke Google Sheets.`;

					return ctx.reply(registeredOotMsg, { parse_mode: "HTML" });
				} else {
					const authLink = `${process.env.APP_URL}/api/auth/google?chat_id=${chatId}`;
					const guestOotMsg =
						`Halo! Saya adalah Asisten Keuangan AI Anda. 👋\n\n` +
						`💡 Anda saat ini berada dalam <b>Mode Guest</b>. Anda dapat mencoba mengirimkan <b>teks catatan transaksi</b>, <b>foto struk</b>, atau <b>file mutasi</b>.\n\n` +
						`🔗 Hubungkan akun Google Anda untuk mengaktifkan pemindaian otomatis Gmail (tiap jam) dan pencatatan otomatis ke Google Sheets:\n` +
						`<a href="${authLink}">👉 Hubungkan Akun Google</a>`;

					return ctx.reply(guestOotMsg, { parse_mode: "HTML" });
				}
			}

			if (!parsed.is_transaction || parsed.nominal === 0) {
				return ctx.reply(
					"❌ Tidak terdeteksi nominal pembayaran yang valid dalam input Anda.",
				);
			}

			if (isRegistered) {
				await runWithChatAction(ctx, "typing", async () => {
					await appendTransactionToSheet(
						user.refresh_token,
						user.spreadsheet_id,
						parsed,
					);
				});
				return ctx.reply(
					formatTransactionNotification(
						parsed,
						"✅ <b>Transaksi Berhasil Dicatat ke Sheets!</b>",
					),
					{ parse_mode: "HTML" },
				);
			} else {
				const authLink = `${process.env.APP_URL}/api/auth/google?chat_id=${chatId}`;
				const guestMessage =
					formatTransactionNotification(
						parsed,
						"🔍 <b>Hasil Ekstraksi Transaksi (Mode Guest)</b>",
					) +
					`\n\n⚠️ <i>Data ini tidak disimpan di database/sheets. <a href="${authLink}">Hubungkan akun Google</a> untuk mengaktifkan fitur simpan & export otomatis.</i>`;

				return ctx.reply(guestMessage, { parse_mode: "HTML" });
			}
		} catch (error) {
			const userFriendlyMessage = handleUserError(error);
			await ctx.reply(userFriendlyMessage);
		}
	});
}
