import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";
import { syncGmailTransactions } from "@/src/lib/gmail";
import { appendTransactionToSheet } from "@/src/lib/sheets";
import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export async function GET(request: Request) {
	const authHeader = request.headers.get("authorization");
	if (
		process.env.CRON_SECRET &&
		authHeader !== `Bearer ${process.env.CRON_SECRET}`
	) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		// Ambil pengguna yang mengaktifkan gmail_sync_enabled
		const { data: users, error } = await supabaseAdmin
			.from("users")
			.select(
				"telegram_chat_id, refresh_token, spreadsheet_id, google_email, gmail_sync_enabled",
			)
			.eq("gmail_sync_enabled", true);

		if (error || !users) throw error;

		let totalSynced = 0;

		for (const user of users) {
			if (!user.refresh_token || !user.spreadsheet_id) continue;

			// Cron Otomatis HANYA memindai 1 hari terakhir (hari ini)
			const transactions = await syncGmailTransactions(
				user.refresh_token,
				user.telegram_chat_id,
				"GoPay",
				1, // Hardcode 1 hari khusus untuk cron-jobs
			);

			for (const tx of transactions) {
				await appendTransactionToSheet(
					user.refresh_token,
					user.spreadsheet_id,
					tx,
				);
				totalSynced++;

				const notifMessage = `📩 <b>Transaksi Gmail Otomatis Dicatat!</b>

📅 <b>Tanggal:</b> ${escapeHtml(tx.tanggal)}
🏪 <b>Merchant:</b> ${escapeHtml(tx.merchant)}
💰 <b>Nominal:</b> Rp ${tx.nominal.toLocaleString("id-ID")}
📊 <b>Tipe:</b> ${tx.tipe === "pemasukan" ? "📈 Pemasukan" : "📉 Pengeluaran"}
🧾 <b>No. Ref:</b> ${escapeHtml(tx.no_referensi || "-")}
🏷️ <b>Kategori:</b> ${escapeHtml(tx.kategori)}
💳 <b>Sumber Dana:</b> ${escapeHtml(tx.sumber_dana)}`;

				await bot.api.sendMessage(user.telegram_chat_id, notifMessage, {
					parse_mode: "HTML",
				});
			}
		}

		return NextResponse.json({
			success: true,
			message: `Berhasil memproses email transaksi. Total ${totalSynced} transaksi dicatat.`,
		});
	} catch (err: any) {
		console.error("Gmail Cron Sync Error:", err);
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}
