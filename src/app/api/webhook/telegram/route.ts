import { NextResponse } from "next/server";
import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";
import { isDuplicateMessage } from "@/src/lib/redis";
import { parseTransactionWithGemini, TransactionData } from "@/src/lib/gemini";
import { syncGmailTransactions } from "@/src/lib/gmail";
import { appendTransactionToSheet } from "@/src/lib/sheets";
import {
	ratelimit,
	containsPromptInjection,
	sanitizeInputText,
} from "@/src/lib/security";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

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
	throw new Error("Gagal mengunduh file setelah beberapa kali percobaan.");
}

function getRangeLabel(days: number): string {
	if (days === 30) return "1 Bulan Terakhir";
	if (days === 90) return "3 Bulan Terakhir";
	return "7 Hari Terakhir";
}

async function renderRegisteredStartMessage(ctx: any, user: any, name: string) {
	const isEnabled = user.gmail_sync_enabled ?? true;
	const currentDays = user.sync_range_days || 7;
	const sheetUrl = `https://docs.google.com/spreadsheets/d/${user.spreadsheet_id}`;

	const statusBadge = isEnabled
		? "🟢 <b>AKTIF</b> (Tiap Jam, 06:00 - 23:00 WIB)"
		: "🔴 <b>NON-AKTIF</b>";

	const text = `Halo, <b>${escapeHtml(name)}</b>! 👋

Akun Anda terhubung dengan:
📧 <b>${escapeHtml(user.google_email)}</b>
📊 <b>Google Sheets:</b> <a href="${sheetUrl}">Buka Spreadsheet</a>

───────────────
📬 <b>STATUS SINKRONISASI GMAIL</b>
• <b>Auto-Sync:</b> ${statusBadge}
• <b>Rentang Pindai:</b> ${getRangeLabel(currentDays)}
───────────────

Klik <b>"🔄 Pindai Sekarang"</b> untuk memeriksa email transaksi instan, atau klik <b>"⚙️ Pengaturan"</b> untuk merubah preferensi.`;

	const keyboard = new InlineKeyboard()
		.text("🔄 Pindai Gmail Sekarang", "action_sync_now")
		.row()
		.text("⚙️ Pengaturan Auto-Sync", "action_open_settings")
		.row()
		.text("🔌 Putus Koneksi Google", "action_confirm_disconnect");

	return { text, keyboard };
}

function renderSettingsMessage(user: any) {
	const isEnabled = user.gmail_sync_enabled ?? true;
	const currentDays = user.sync_range_days || 7;

	const statusBadge = isEnabled ? "🟢 AKTIF" : "🔴 NON-AKTIF";

	const text = `⚙️ <b>PENGATURAN SINKRONISASI GMAIL</b>

<b>Status Auto-Sync:</b> ${statusBadge}
<b>Rentang Pindai Email:</b> ${getRangeLabel(currentDays)}

<i>Gunakan tombol di bawah untuk mengubah status atau rentang riwayat email yang akan dipindai:</i>`;

	const keyboard = new InlineKeyboard()
		.text(
			isEnabled ? "🔴 Matikan Auto-Sync" : "🟢 Nyalakan Auto-Sync",
			`toggle_sync:${isEnabled ? "off" : "on"}`,
		)
		.row()
		.text(currentDays === 7 ? "🔘 7 Hari" : "⚪ 7 Hari", "set_range:7")
		.text(currentDays === 30 ? "🔘 1 Bulan" : "⚪ 1 Bulan", "set_range:30")
		.text(currentDays === 90 ? "🔘 3 Bulan" : "⚪ 3 Bulan", "set_range:90")
		.row()
		.text("« Kembali ke Menu Utama", "action_back_home");

	return { text, keyboard };
}

// Command /start
bot.command("start", async (ctx) => {
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
		const { text, keyboard } = await renderRegisteredStartMessage(
			ctx,
			user,
			firstName,
		);
		await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
	} else {
		const authLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google?chat_id=${chatId}`;
		const unregisteredMessage = `
Selamat datang di <b>Sanora Finance AI Bot</b>, <b>${escapeHtml(firstName)}</b>! 🚀

💡 <b>Mode Guest (Uji Coba Langsung):</b>
Anda dapat langsung mengirim **teks transaksi**, **foto struk**, atau **file mutasi**.

🔗 Hubungkan akun Google Anda untuk fitur simpan otomatis & sinkronisasi Gmail:
<a href="${authLink}">👉 Hubungkan Akun Google</a>
`;
		await ctx.reply(unregisteredMessage, { parse_mode: "HTML" });
	}
});

// Command /sync
bot.command("sync", async (ctx) => {
	await triggerManualSync(ctx);
});

// Command /settings
bot.command("settings", async (ctx) => {
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
});

// Command /disconnect (Memutus koneksi Google & kembali ke Mode Guest)
bot.command("disconnect", async (ctx) => {
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
});

// Command /deleteaccount (Menghapus seluruh data user dari database)
bot.command("deleteaccount", async (ctx) => {
	const chatId = ctx.chat.id;

	const keyboard = new InlineKeyboard()
		.text("🔴 Ya, Hapus Data Saya", "action_confirm_delete")
		.text("❌ Batal", "action_back_home");

	await ctx.reply(
		`⚠️ <b>KONFIRMASI HAPUS DATA AKUN</b>\n\nApakah Anda yakin ingin menghapus seluruh data pendaftaran akun Anda dari SanoraFinbot?\n\n<i>Catatan: File Google Sheets yang sudah terbuat di Google Drive Anda TIDAK akan terhapus.</i>`,
		{ parse_mode: "HTML", reply_markup: keyboard },
	);
});

async function triggerManualSync(ctx: any) {
	const chatId = ctx.chat?.id;

	const { data: user } = await supabaseAdmin
		.from("users")
		.select("*")
		.eq("telegram_chat_id", chatId)
		.single();

	if (!user || !user.refresh_token || !user.spreadsheet_id) {
		const authLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google?chat_id=${chatId}`;
		return ctx.reply(
			`⚠️ Harap hubungkan akun Google Anda terlebih dahulu:\n${authLink}`,
		);
	}

	const rangeText = getRangeLabel(user.sync_range_days || 7);
	await ctx.reply(`⏳ Memindai email transaksi Gmail (${rangeText})...`);

	try {
		const transactions = await syncGmailTransactions(
			user.refresh_token,
			user.telegram_chat_id,
			"GoPay",
			user.sync_range_days || 7,
		);

		if (transactions.length === 0) {
			return ctx.reply(
				`✅ Pemindaian selesai! Tidak ada transaksi baru di Gmail (${rangeText}).`,
			);
		}

		for (const tx of transactions) {
			await appendTransactionToSheet(
				user.refresh_token,
				user.spreadsheet_id,
				tx,
			);

			const notifMessage = `📩 <b>Transaksi Gmail Dicatat!</b>

📅 <b>Tanggal:</b> ${escapeHtml(tx.tanggal)}
🏪 <b>Merchant:</b> ${escapeHtml(tx.merchant)}
💰 <b>Nominal:</b> Rp ${tx.nominal.toLocaleString("id-ID")}
📊 <b>Tipe:</b> ${tx.tipe === "pemasukan" ? "📈 Pemasukan" : "📉 Pengeluaran"}
🧾 <b>No. Ref:</b> ${escapeHtml(tx.no_referensi || "-")}
🏷️ <b>Kategori:</b> ${escapeHtml(tx.kategori)}
💳 <b>Sumber Dana:</b> ${escapeHtml(tx.sumber_dana)}`;

			await ctx.reply(notifMessage, { parse_mode: "HTML" });
		}
	} catch (err: any) {
		console.error("Manual Sync Error:", err);
		await ctx.reply(
			"❌ Gagal memindai email. Silakan coba beberapa saat lagi.",
		);
	}
}

// HANDLER INLINE KEYBOARD (BUTTONS)
bot.on("callback_query:data", async (ctx) => {
	const data = ctx.callbackQuery.data;
	const chatId = ctx.chat?.id;
	const firstName = ctx.from?.first_name || ctx.from?.username || "Pengguna";

	if (data === "action_sync_now") {
		await ctx.answerCallbackQuery({ text: "Memulai pemindaian Gmail..." });
		await triggerManualSync(ctx);
		return;
	}

	if (data === "action_open_settings") {
		await ctx.answerCallbackQuery();
		const { data: user } = await supabaseAdmin
			.from("users")
			.select("gmail_sync_enabled, sync_range_days")
			.eq("telegram_chat_id", chatId)
			.single();

		if (user) {
			const { text, keyboard } = renderSettingsMessage(user);
			await ctx.editMessageText(text, {
				parse_mode: "HTML",
				reply_markup: keyboard,
			});
		}
		return;
	}

	if (data === "action_back_home") {
		await ctx.answerCallbackQuery();
		const { data: user } = await supabaseAdmin
			.from("users")
			.select(
				"google_email, spreadsheet_id, gmail_sync_enabled, sync_range_days, refresh_token",
			)
			.eq("telegram_chat_id", chatId)
			.single();

		if (user && user.refresh_token) {
			const { text, keyboard } = await renderRegisteredStartMessage(
				ctx,
				user,
				firstName,
			);
			await ctx.editMessageText(text, {
				parse_mode: "HTML",
				reply_markup: keyboard,
			});
		} else {
			const authLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google?chat_id=${chatId}`;
			await ctx.editMessageText(
				`Selamat datang di <b>Sanora Finance AI Bot</b>, <b>${escapeHtml(firstName)}</b>!\n\n💡 <b>Mode Guest (Uji Coba Langsung):</b> Anda dapat langsung mengirim teks, foto, atau file mutasi.\n\n🔗 <a href="${authLink}">Hubungkan Akun Google</a>`,
				{ parse_mode: "HTML" },
			);
		}
		return;
	}

	if (data === "action_confirm_disconnect") {
		await ctx.answerCallbackQuery();
		await supabaseAdmin
			.from("users")
			.update({
				google_email: null,
				refresh_token: null,
				spreadsheet_id: null,
				gmail_sync_enabled: false,
			})
			.eq("telegram_chat_id", chatId);

		await ctx.editMessageText(
			`🔌 <b>Koneksi Google Diberhentikan!</b>\n\nAkun Anda telah dikembalikan ke <b>Mode Guest</b>. Ketik /start jika ingin menghubungkan kembali.`,
			{ parse_mode: "HTML" },
		);
		return;
	}

	if (data === "action_confirm_delete") {
		await ctx.answerCallbackQuery();
		await supabaseAdmin.from("users").delete().eq("telegram_chat_id", chatId);

		await ctx.editMessageText(
			`🗑️ <b>Data Akun Berhasil Dihapus!</b>\n\nSeluruh preferensi Anda di database telah dibersihkan.`,
			{ parse_mode: "HTML" },
		);
		return;
	}

	if (data.startsWith("toggle_sync:")) {
		const action = data.split(":")[1];
		const isEnabled = action === "on";

		await supabaseAdmin
			.from("users")
			.update({ gmail_sync_enabled: isEnabled })
			.eq("telegram_chat_id", chatId);

		await ctx.answerCallbackQuery({
			text: isEnabled ? "🟢 Auto-sync Diaktifkan!" : "🔴 Auto-sync Dimatikan!",
		});

		const { data: updatedUser } = await supabaseAdmin
			.from("users")
			.select("gmail_sync_enabled, sync_range_days")
			.eq("telegram_chat_id", chatId)
			.single();

		if (updatedUser) {
			const { text, keyboard } = renderSettingsMessage(updatedUser);
			await ctx.editMessageText(text, {
				parse_mode: "HTML",
				reply_markup: keyboard,
			});
		}
		return;
	}

	if (data.startsWith("set_range:")) {
		const days = parseInt(data.split(":")[1], 10);

		await supabaseAdmin
			.from("users")
			.update({ sync_range_days: days })
			.eq("telegram_chat_id", chatId);

		await ctx.answerCallbackQuery({
			text: `Rentang pindai diubah ke ${getRangeLabel(days)}!`,
		});

		const { data: updatedUser } = await supabaseAdmin
			.from("users")
			.select("gmail_sync_enabled, sync_range_days")
			.eq("telegram_chat_id", chatId)
			.single();

		if (updatedUser) {
			const { text, keyboard } = renderSettingsMessage(updatedUser);
			await ctx.editMessageText(text, {
				parse_mode: "HTML",
				reply_markup: keyboard,
			});
		}
		return;
	}
});

// Handling Pesan Transaksi (Teks, Foto Struk, & File Document/Mutasi)
bot.on("message", async (ctx) => {
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

	const { data: user } = await supabaseAdmin
		.from("users")
		.select("*")
		.eq("telegram_chat_id", chatId)
		.single();

	const isRegistered = !!(user && user.refresh_token && user.spreadsheet_id);

	try {
		let parsed: TransactionData;

		if (ctx.message.photo) {
			await ctx.reply("🔍 Membaca foto struk...");
			const file = await ctx.getFile();
			const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

			const response = await fetchWithRetry(fileUrl);
			const arrayBuffer = await response.arrayBuffer();
			const base64Image = Buffer.from(arrayBuffer).toString("base64");

			parsed = await parseTransactionWithGemini({
				inlineData: { mimeType: "image/jpeg", data: base64Image },
			});
		} else if (ctx.message.document) {
			await ctx.reply("📄 Membaca dokumen mutasi rekening...");
			const doc = ctx.message.document;
			const mimeType = doc.mime_type || "application/pdf";

			const file = await ctx.getFile();
			const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

			const response = await fetchWithRetry(fileUrl);
			const arrayBuffer = await response.arrayBuffer();
			const base64Data = Buffer.from(arrayBuffer).toString("base64");

			parsed = await parseTransactionWithGemini({
				inlineData: { mimeType, data: base64Data },
			});
		} else if (ctx.message.text) {
			const sanitizedText = sanitizeInputText(ctx.message.text);

			if (containsPromptInjection(sanitizedText)) {
				return ctx.reply(
					"Maaf, saya adalah asisten keuangan pribadi Anda. Saya tidak dapat memberikan informasi teknis sistem atau menjalankan perintah di luar pencatatan keuangan.",
				);
			}

			parsed = await parseTransactionWithGemini(sanitizedText);
		} else {
			return;
		}

		if (parsed.is_oot) {
			return ctx.reply(
				parsed.oot_response ||
					"Maaf, saya hanya dapat membantu pencatatan dan analisis keuangan Anda.",
			);
		}

		if (!parsed.is_transaction || parsed.nominal === 0) {
			return ctx.reply(
				"❌ Tidak terdeteksi nominal pembayaran yang valid dalam input Anda.",
			);
		}

		if (isRegistered) {
			await appendTransactionToSheet(
				user.refresh_token,
				user.spreadsheet_id,
				parsed,
			);

			const successMessage = `✅ <b>Transaksi Berhasil Dicatat ke Sheets!</b>

📅 <b>Tanggal:</b> ${escapeHtml(parsed.tanggal)}
🏪 <b>Merchant:</b> ${escapeHtml(parsed.merchant)}
💰 <b>Nominal:</b> Rp ${parsed.nominal.toLocaleString("id-ID")}
📊 <b>Tipe:</b> ${parsed.tipe === "pemasukan" ? "📈 Pemasukan" : "📉 Pengeluaran"}
Receipt <b>No. Ref:</b> ${escapeHtml(parsed.no_referensi || "-")}
🏷️ <b>Kategori:</b> ${escapeHtml(parsed.kategori)}
💳 <b>Sumber Dana:</b> ${escapeHtml(parsed.sumber_dana)}`;

			return ctx.reply(successMessage, { parse_mode: "HTML" });
		} else {
			const authLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google?chat_id=${chatId}`;
			const guestMessage = `🔍 <b>Hasil Ekstraksi Transaksi (Mode Guest)</b>

📅 <b>Tanggal:</b> ${escapeHtml(parsed.tanggal)}
🏪 <b>Merchant:</b> ${escapeHtml(parsed.merchant)}
💰 <b>Nominal:</b> Rp ${parsed.nominal.toLocaleString("id-ID")}
📊 <b>Tipe:</b> ${parsed.tipe === "pemasukan" ? "📈 Pemasukan" : "📉 Pengeluaran"}
Receipt <b>No. Ref:</b> ${escapeHtml(parsed.no_referensi || "-")}
🏷️ <b>Kategori:</b> ${escapeHtml(parsed.kategori)}
💳 <b>Sumber Dana:</b> ${escapeHtml(parsed.sumber_dana)}

⚠️ <i>Data ini tidak disimpan di database/sheets. <a href="${authLink}">Hubungkan akun Google</a> untuk mengaktifkan fitur simpan & export otomatis.</i>`;

			return ctx.reply(guestMessage, { parse_mode: "HTML" });
		}
	} catch (error) {
		console.error("Webhook Handling Error:", error);
		await ctx.reply(
			"⚠️ Terjadi gangguan saat membaca data/dokumen Anda. Silakan coba lagi.",
		);
	}
});

export const POST = webhookCallback(bot, "std/http");
