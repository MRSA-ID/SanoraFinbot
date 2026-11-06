import { NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/src/lib/supabaseAdmin";
import { encrypt } from "@/src/lib/crypto";
import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const code = searchParams.get("code");
	const chatId = searchParams.get("state"); // telegram_chat_id

	if (!code || !chatId) {
		return NextResponse.json(
			{ error: "Invalid OAuth callback data" },
			{ status: 400 },
		);
	}

	try {
		const oauth2Client = new google.auth.OAuth2(
			process.env.GOOGLE_CLIENT_ID,
			process.env.GOOGLE_CLIENT_SECRET,
			process.env.GOOGLE_REDIRECT_URI,
		);

		const { tokens } = await oauth2Client.getToken(code);
		oauth2Client.setCredentials(tokens);

		if (!tokens.refresh_token) {
			return NextResponse.json(
				{ error: "Failed to retrieve refresh token. Please re-consent." },
				{ status: 400 },
			);
		}

		// 1. Ambil Email User Google
		const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
		const userInfo = await oauth2.userinfo.get();
		const userEmail = userInfo.data.email || "";

		// 2. Buat File Google Sheets Baru di Drive User (9 Kolom Resmi)
		const now = new Date();
		const months = [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"Mei",
			"Jun",
			"Jul",
			"Agu",
			"Sep",
			"Okt",
			"Nov",
			"Des",
		];
		const initialSheetName = `${months[now.getMonth()]}-${now.getFullYear()}`;

		const sheets = google.sheets({ version: "v4", auth: oauth2Client });
		const spreadsheet = await sheets.spreadsheets.create({
			requestBody: {
				properties: {
					title: `Sanora Finance Tracker - ${userEmail}`,
				},
				sheets: [
					{
						properties: {
							title: initialSheetName,
						},
						data: [
							{
								startRow: 0,
								startColumn: 0,
								rowData: [
									{
										values: [
											{ userEnteredValue: { stringValue: "Tanggal" } },
											{
												userEnteredValue: {
													stringValue: "Merchant / Deskripsi",
												},
											},
											{ userEnteredValue: { stringValue: "Nominal (Rp)" } },
											{ userEnteredValue: { stringValue: "Tipe" } },
											{ userEnteredValue: { stringValue: "No. Referensi" } },
											{ userEnteredValue: { stringValue: "Kategori" } },
											{ userEnteredValue: { stringValue: "Sumber Dana" } },
											{ userEnteredValue: { stringValue: "createdAt" } },
											{ userEnteredValue: { stringValue: "updatedAt" } },
										],
									},
								],
							},
						],
					},
				],
			},
		});

		const spreadsheetId = spreadsheet.data.spreadsheetId!;

		// 3. Encrypt Refresh Token & Simpan ke Supabase
		const encryptedRefreshToken = encrypt(tokens.refresh_token);

		const { error: dbError } = await supabaseAdmin.from("users").upsert(
			{
				telegram_chat_id: parseInt(chatId, 10),
				google_email: userEmail,
				refresh_token: encryptedRefreshToken,
				spreadsheet_id: spreadsheetId,
			},
			{ onConflict: "telegram_chat_id" },
		);

		if (dbError) throw dbError;

		// 4. Kirim Pesan Konfirmasi Langsung ke Telegram User via Bot API
		const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
		const successNotif = `✅ <b>Registrasi Berhasil!</b>

Akun Google (<b>${escapeHtml(userEmail)}</b>) telah terhubung.
File spreadsheet Anda telah dibuat di Google Drive:
📊 <a href="${sheetUrl}">Buka Google Sheets Anda</a>

Sekarang Anda bisa langsung mengirim pesan transaksi atau foto struk di sini! 🚀`;

		await bot.api.sendMessage(chatId, successNotif, {
			parse_mode: "HTML",
		});

		// 5. Redirect User Kembali ke Halaman Web Sukses
		return NextResponse.redirect(`${process.env.APP_URL}/success`);
	} catch (error: any) {
		console.error("OAuth Callback Error:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
