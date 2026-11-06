import { google } from "googleapis";
import { decrypt } from "@/src/lib/crypto";
import { parseTransactionWithGemini, TransactionData } from "@/src/lib/gemini";
import {
	isGmailProcessed,
	isRefNoProcessed,
	isDuplicateGmailTx,
} from "@/src/lib/redis";

function formatToWIB(dateString: string): string {
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return dateString;

		const formatter = new Intl.DateTimeFormat("id-ID", {
			timeZone: "Asia/Jakarta",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});

		const parts = formatter.formatToParts(date);
		const getPart = (type: string) =>
			parts.find((p) => p.type === type)?.value || "00";

		return `${getPart("year")}-${getPart("month")}-${getPart("day")} ${getPart("hour")}:${getPart("minute")}`;
	} catch (err) {
		return dateString;
	}
}

export async function syncGmailTransactions(
	encryptedRefreshToken: string,
	chatId: number,
	userFavoriteWallet = "GoPay",
	daysRange = 7, // Default 7 hari, opsional 30 atau 90 hari
): Promise<TransactionData[]> {
	const refreshToken = decrypt(encryptedRefreshToken);

	const oauth2Client = new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
	);

	oauth2Client.setCredentials({ refresh_token: refreshToken });

	const gmail = google.gmail({ version: "v1", auth: oauth2Client });

	const officialSenders = [
		"bca.co.id",
		"mandiri",
		"bri.co.id",
		"bni.co.id",
		"bankjago.com",
		"bsinet.ai",
		"cimbniaga.co.id",
		"permatabank.co.id",
		"jenius.com",
		"seabank.co.id",
		"danamon.co.id",
		"gojek.com",
		"grab.com",
		"ovo.id",
		"dana.id",
		"shopee.co.id",
		"tokopedia.com",
		"blibli.com",
		"lazada.co.id",
		"bukalapak.com",
		"traveloka.com",
		"tiket.com",
		"bluebirdgroup.com",
		"kai.id",
		"apple.com",
		"play-music-support@google.com",
		"netflix.com",
		"spotify.com",
	]
		.map((domain) => `from:${domain}`)
		.join(" OR ");

	const transactionKeywords =
		'subject:("QRIS" OR "struk" OR "invoice" OR "tagihan" OR "bukti pembayaran" OR "transaksi berhasil" OR "pembayaran berhasil" OR "kuitansi")';

	// Menggunakan variabel daysRange dinamis (7d, 30d, 90d)
	const query = `newer_than:${daysRange}d -category:social -category:promotions ((${officialSenders}) OR (${transactionKeywords}))`;

	const res = await gmail.users.messages.list({
		userId: "me",
		q: query,
		maxResults: 15,
	});

	const messages = res.data.messages || [];
	const transactions: TransactionData[] = [];

	for (const msg of messages) {
		if (!msg.id) continue;

		const isAlreadyProcessed = await isGmailProcessed(msg.id);
		if (isAlreadyProcessed) continue;

		await new Promise((resolve) => setTimeout(resolve, 800));

		const messageData = await gmail.users.messages.get({
			userId: "me",
			id: msg.id,
			format: "full",
		});

		const payload = messageData.data.payload;
		let bodyText = messageData.data.snippet || "";

		if (payload?.parts) {
			for (const part of payload.parts) {
				if (part.mimeType === "text/plain" && part.body?.data) {
					bodyText +=
						" " + Buffer.from(part.body.data, "base64").toString("utf-8");
				}
			}
		}

		const headers = payload?.headers || [];
		const subject =
			headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
		const from =
			headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
		const rawEmailDate =
			headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

		const formattedWibDate = formatToWIB(rawEmailDate);

		const fullEmailContext = `Date Sent (WIB): ${formattedWibDate}\nFrom: ${from}\nSubject: ${subject}\nBody: ${bodyText}`;

		const parsed = await parseTransactionWithGemini(fullEmailContext);

		if (parsed.is_transaction && formattedWibDate) {
			parsed.tanggal = formattedWibDate;
		}

		if (parsed.is_transaction && !parsed.is_oot && parsed.nominal > 0) {
			if (parsed.no_referensi && parsed.no_referensi.trim() !== "") {
				const isRefDuplicate = await isRefNoProcessed(parsed.no_referensi);
				if (isRefDuplicate) continue;
			}

			if (
				!parsed.sumber_dana ||
				parsed.sumber_dana === "Belum Diketahui" ||
				parsed.sumber_dana === "Tidak disebutkan"
			) {
				parsed.sumber_dana = userFavoriteWallet;
			}

			const isDuplicateTx = await isDuplicateGmailTx(
				chatId,
				parsed.nominal,
				parsed.tanggal,
			);

			if (!isDuplicateTx) {
				transactions.push(parsed);
			}
		}
	}

	return transactions;
}
