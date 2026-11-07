import { InlineKeyboard } from "grammy";
import { TransactionData } from "@/src/lib/gemini";

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function getRangeLabel(days: number): string {
	if (days === 30) return "1 Bulan Terakhir";
	if (days === 90) return "3 Bulan Terakhir";
	return "7 Hari Terakhir";
}

export function renderRegisteredStartMessage(user: any, name: string) {
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

export function renderSettingsMessage(user: any) {
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

export function formatTransactionNotification(
	tx: TransactionData | any,
	title = "📩 <b>Transaksi Gmail Dicatat!</b>",
): string {
	return `${title}

📅 <b>Tanggal:</b> ${escapeHtml(tx.tanggal)}
🏪 <b>Merchant:</b> ${escapeHtml(tx.merchant)}
💰 <b>Nominal:</b> Rp ${tx.nominal.toLocaleString("id-ID")}
📊 <b>Tipe:</b> ${tx.tipe === "pemasukan" ? "📈 Pemasukan" : "📉 Pengeluaran"}
Receipt <b>No. Ref:</b> ${escapeHtml(tx.no_referensi || "-")}
🏷️ <b>Kategori:</b> ${escapeHtml(tx.kategori)}
💳 <b>Sumber Dana:</b> ${escapeHtml(tx.sumber_dana)}`;
}
