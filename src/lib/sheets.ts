import { google } from "googleapis";
import { decrypt } from "./crypto";
import { TransactionData } from "./gemini";
import { AppError } from "@/src/bot/helpers/errors";

function getCurrentTimestampWIB(): string {
	const now = new Date();
	const formatter = new Intl.DateTimeFormat("id-ID", {
		timeZone: "Asia/Jakarta",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	const parts = formatter.formatToParts(now);
	const getPart = (type: string) =>
		parts.find((p) => p.type === type)?.value || "00";

	return `${getPart("year")}-${getPart("month")}-${getPart("day")} ${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
}

async function ensureMonthlySheet(
	sheets: any,
	spreadsheetId: string,
	sheetName: string,
) {
	try {
		const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
		const existingSheets = spreadsheet.data.sheets || [];
		const sheetExists = existingSheets.some(
			(s: any) => s.properties?.title === sheetName,
		);

		if (!sheetExists) {
			await sheets.spreadsheets.batchUpdate({
				spreadsheetId,
				requestBody: {
					requests: [
						{
							addSheet: {
								properties: {
									title: sheetName,
								},
							},
						},
					],
				},
			});
		}

		// Update header 9 Kolom
		await sheets.spreadsheets.values.update({
			spreadsheetId,
			range: `'${sheetName}'!A1:I1`,
			valueInputOption: "USER_ENTERED",
			requestBody: {
				values: [
					[
						"Tanggal",
						"Merchant / Deskripsi",
						"Nominal (Rp)",
						"Tipe",
						"No. Referensi",
						"Kategori",
						"Sumber Dana",
						"createdAt",
						"updatedAt",
					],
				],
			},
		});
	} catch (err: any) {
		if (err.status === 404) {
			throw new AppError(
				"⚠️ File Google Sheets tidak ditemukan di Drive Anda. Harap hubungkan kembali akun Google.",
			);
		}
		throw err;
	}
}

export async function appendTransactionToSheet(
	encryptedRefreshToken: string,
	spreadsheetId: string,
	transaction: TransactionData,
) {
	try {
		const refreshToken = decrypt(encryptedRefreshToken);

		const oauth2Client = new google.auth.OAuth2(
			process.env.GOOGLE_CLIENT_ID,
			process.env.GOOGLE_CLIENT_SECRET,
			process.env.GOOGLE_REDIRECT_URI,
		);

		oauth2Client.setCredentials({ refresh_token: refreshToken });
		const sheets = google.sheets({ version: "v4", auth: oauth2Client });

		const nowWib = getCurrentTimestampWIB();

		const txDate = transaction.tanggal
			? new Date(transaction.tanggal)
			: new Date();
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
		const sheetName = `${months[txDate.getMonth()]}-${txDate.getFullYear()}`;

		await ensureMonthlySheet(sheets, spreadsheetId, sheetName);

		// Kirim nominal sebagai angka murni (number) agar Google Sheets mengenalnya sebagai Currency
		const values = [
			[
				transaction.tanggal,
				transaction.merchant,
				transaction.nominal,
				transaction.tipe || "pengeluaran",
				transaction.no_referensi || "-",
				transaction.kategori,
				transaction.sumber_dana,
				nowWib,
				nowWib,
			],
		];

		const response = await sheets.spreadsheets.values.append({
			spreadsheetId,
			range: `'${sheetName}'!A:I`,
			valueInputOption: "USER_ENTERED",
			requestBody: {
				values,
			},
		});

		// Otomatis format kolom C (Nominal) di Google Sheets menjadi format Rupiah "Rp 155.289"
		try {
			const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
			const targetSheet = sheetMetadata.data.sheets?.find(
				(s: any) => s.properties?.title === sheetName,
			);
			const sheetId = targetSheet?.properties?.sheetId;

			if (sheetId !== undefined) {
				await sheets.spreadsheets.batchUpdate({
					spreadsheetId,
					requestBody: {
						requests: [
							{
								repeatCell: {
									range: {
										sheetId: sheetId,
										startColumnIndex: 2, // Kolom C (Nominal)
										endColumnIndex: 3,
										startRowIndex: 1, // Mulai setelah header
									},
									cell: {
										userEnteredFormat: {
											numberFormat: {
												type: "CURRENCY",
												pattern: '"Rp"#,##0',
											},
										},
									},
									fields: "userEnteredFormat.numberFormat",
								},
							},
						],
					},
				});
			}
		} catch (formatErr) {
			console.warn("Gagal menerapkan numberFormat otomatis:", formatErr);
		}

		return response.data;
	} catch (err: any) {
		const msg = err.message?.toLowerCase() || "";
		if (
			msg.includes("invalid_grant") ||
			msg.includes("token has been expired or revoked")
		) {
			throw new AppError(
				"⚠️ Otorisasi Google Anda telah kadaluarsa. Silakan ketik /start untuk menghubungkan ulang akun Google.",
			);
		}
		if (err instanceof AppError) throw err;
		console.error("Google Sheets Write Error:", err);
		throw new AppError(
			"⚠️ Gagal mencatat data ke Google Sheets. Silakan coba beberapa saat lagi.",
		);
	}
}
