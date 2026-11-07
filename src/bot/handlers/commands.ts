import { supabaseAdmin } from "@/src/lib/supabaseAdmin";
import { syncGmailTransactions } from "@/src/lib/gmail";
import { appendTransactionToSheet } from "@/src/lib/sheets";
import { InlineKeyboard } from "grammy";
import { redis } from "@/src/lib/redis";
import {
	escapeHtml,
	getRangeLabel,
	renderRegisteredStartMessage,
	renderSettingsMessage,
	formatTransactionNotification,
} from "../helpers/formatters";
import { runWithChatAction, withSessionLock } from "../helpers/chatActions";
import { handleUserError } from "../helpers/errors";

export async function handleStartCommand(ctx: any) {
	const chatId = ctx.chat.id;
	const firstName = ctx.from?.first_name || ctx.from?.username || "Pengguna";

	const { data: user } = await supabaseAdmin
		.from("users")
		.select(
			"google_email, spreadsheet_id, gmail_sync_enabled, sync_range_days, refresh_token",
		)
		.eq("telegram_chat_id", chatId)
		.single();

	if (user && user.refresh_token) {
		const { text, keyboard } = renderRegisteredStartMessage(user, firstName);
		await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
	} else {
		const authLink = `${process.env.APP_URL}/api/auth/google?chat_id=${chatId}`;
		const unregisteredMessage = `Selamat datang di <b>Sanora Finance AI Bot</b>, <b>${escapeHtml(firstName)}</b>! 🚀

💡 <b>Mode Guest (Uji Coba Langsung):</b>
Anda dapat langsung mengirim **teks transaksi**, **foto struk**, atau **file mutasi**.

🔗 Hubungkan akun Google Anda untuk fitur simpan otomatis & sinkronisasi Gmail:
<a href="${authLink}">👉 Hubungkan Akun Google</a>`;
		await ctx.reply(unregisteredMessage, { parse_mode: "HTML" });
	}
}

export async function triggerManualSync(ctx: any) {
	await withSessionLock(ctx, async () => {
		const chatId = ctx.chat?.id;

		const { data: user } = await supabaseAdmin
			.from("users")
			.select("*")
			.eq("telegram_chat_id", chatId)
			.single();

		if (!user || !user.refresh_token || !user.spreadsheet_id) {
			const authLink = `${process.env.APP_URL}/api/auth/google?chat_id=${chatId}`;
			return ctx.reply(
				`⚠️ Harap hubungkan akun Google Anda terlebih dahulu:\n${authLink}`,
			);
		}

		const rangeDays = user.sync_range_days || 7;
		const rangeText = getRangeLabel(rangeDays);
		const loadingMsg = await ctx.reply(
			`⏳ Memindai email transaksi Gmail (${rangeText})...`,
		);

		try {
			const transactions = await runWithChatAction(ctx, "typing", async () => {
				return await syncGmailTransactions(
					user.refresh_token,
					user.telegram_chat_id,
					"GoPay",
					rangeDays,
				);
			});

			if (!transactions || transactions.length === 0) {
				return ctx.api.editMessageText(
					chatId,
					loadingMsg.message_id,
					`✅ Pemindaian selesai! Tidak ada transaksi baru di Gmail (${rangeText}).`,
				);
			}

			await ctx.api.editMessageText(
				chatId,
				loadingMsg.message_id,
				`✅ Pemindaian selesai! Ditemukan ${transactions.length} transaksi baru.`,
			);

			for (const tx of transactions) {
				await appendTransactionToSheet(
					user.refresh_token,
					user.spreadsheet_id,
					tx,
				);
				await ctx.reply(formatTransactionNotification(tx), {
					parse_mode: "HTML",
				});
			}
		} catch (err: any) {
			const userFriendlyMessage = handleUserError(
				err,
				"❌ Gagal memindai email Gmail. Silakan coba beberapa saat lagi.",
			);
			await ctx.api.editMessageText(
				chatId,
				loadingMsg.message_id,
				userFriendlyMessage,
			);
		}
	});
}

export async function handleSettingsCommand(ctx: any) {
	const chatId = ctx.chat.id;
	const { data: user } = await supabaseAdmin
		.from("users")
		.select("gmail_sync_enabled, sync_range_days, refresh_token")
		.eq("telegram_chat_id", chatId)
		.single();

	if (!user || !user.refresh_token) {
		return ctx.reply(
			"⚠️ Anda berada dalam Mode Guest. Hubungkan akun Google terlebih dahulu.",
		);
	}

	const { text, keyboard } = renderSettingsMessage(user);
	await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
}

export async function handleDisconnectCommand(ctx: any) {
	const chatId = ctx.chat.id;
	const { data: user } = await supabaseAdmin
		.from("users")
		.select("google_email")
		.eq("telegram_chat_id", chatId)
		.single();

	if (!user || !user.google_email) {
		return ctx.reply("⚠️ Anda tidak terhubung ke akun Google mana pun.");
	}

	await supabaseAdmin
		.from("users")
		.update({
			google_email: null,
			refresh_token: null,
			spreadsheet_id: null,
			gmail_sync_enabled: false,
		})
		.eq("telegram_chat_id", chatId);

	await ctx.reply(
		`🔌 <b>Koneksi Google Diberhentikan!</b>\n\nAkun Anda telah dikembalikan ke <b>Mode Guest</b>. Bot tidak akan memindai Gmail atau menyimpan data ke Google Sheets lagi.`,
		{ parse_mode: "HTML" },
	);
}

export async function handleDeleteAccountCommand(ctx: any) {
	const keyboard = new InlineKeyboard()
		.text("🔴 Ya, Hapus Data Saya", "action_confirm_delete")
		.text("❌ Batal", "action_back_home");

	await ctx.reply(
		`⚠️ <b>KONFIRMASI HAPUS DATA AKUN</b>\n\nApakah Anda yakin ingin menghapus seluruh data pendaftaran akun Anda dari SanoraFinbot?\n\n<i>Catatan: File Google Sheets yang sudah terbuat di Google Drive Anda TIDAK akan terhapus.</i>`,
		{ parse_mode: "HTML", reply_markup: keyboard },
	);
}

export async function handleAdminUsageCommand(ctx: any) {
	const chatId = ctx.chat.id;
	const adminId = process.env.ADMIN_TELEGRAM_ID;

	// Proteksi: Hanya Admin yang diperbolehkan melihat
	if (String(chatId) !== String(adminId)) {
		return ctx.reply("⚠️ Perintah ini tidak dikenali.");
	}

	try {
		const globalTotal = (await redis.get("usage:tokens:global_total")) || 0;

		const { data: registeredUsers } = await supabaseAdmin
			.from("users")
			.select("telegram_chat_id, google_email");

		const userEmailMap = new Map<number, string>();
		if (registeredUsers) {
			registeredUsers.forEach((u) => {
				if (u.google_email) {
					userEmailMap.set(Number(u.telegram_chat_id), u.google_email);
				}
			});
		}

		const keys = await redis.keys("usage:tokens:*");
		const userKeys = keys.filter((k) => k !== "usage:tokens:global_total");

		let reportText = `📊 <b>LAPORAN PENGGUNAAN TOKEN GEMINI (ADMIN)</b>\n\n`;
		reportText += `🌐 <b>Total Penggunaan Global:</b> ${Number(globalTotal).toLocaleString("id-ID")} Tokens\n`;
		reportText += `───────────────\n`;

		if (userKeys.length === 0) {
			reportText += `<i>Belum ada data penggunaan token.</i>`;
		} else {
			for (const key of userKeys) {
				const targetChatId = Number(key.replace("usage:tokens:", ""));
				const tokenCount = (await redis.get(key)) || 0;
				const userEmail = userEmailMap.get(targetChatId);

				const statusBadge = userEmail ? "🟢 Registered" : "⚪ Guest";
				const identityText = userEmail
					? `📧 <b>Email:</b> ${userEmail}`
					: `👤 <b>Tipe:</b> Guest User`;

				reportText += `${statusBadge}\n`;
				reportText += `${identityText}\n`;
				reportText += `🆔 <b>Chat ID:</b> <code>${targetChatId}</code>\n`;
				reportText += `🔢 <b>Total Token:</b> ${Number(tokenCount).toLocaleString("id-ID")} Tokens\n\n`;
			}
		}

		await ctx.reply(reportText, { parse_mode: "HTML" });
	} catch (err: any) {
		console.error("Admin Usage Error:", err);
		await ctx.reply(
			"⚠️ Terjadi kesalahan saat menarik laporan penggunaan token.",
		);
	}
}
