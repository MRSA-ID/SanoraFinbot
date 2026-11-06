import { Redis } from "@upstash/redis";

export const redis = new Redis({
	url: process.env.UPSTASH_REDIS_REST_URL!,
	token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * 1. Deduplikasi Message ID Gmail (Masa simpan: 30 Hari)
 * Mencegah email yang sama diproses berulang kali oleh cron job.
 */
export async function isGmailProcessed(messageId: string): Promise<boolean> {
	const key = `gmail_msg:${messageId}`;
	const exists = await redis.get(key);
	if (exists) return true;

	await redis.set(key, "1", { ex: 60 * 60 * 24 * 30 });
	return false;
}

/**
 * 2. Deduplikasi Nomor Referensi / Order ID / Struk (Masa simpan: 30 Hari)
 * Mencegah email kedua dengan invoice/ref ID yang sama dicatat berulang.
 */
export async function isRefNoProcessed(refNo: string): Promise<boolean> {
	if (!refNo || refNo.trim() === "") return false;
	const key = `tx_ref:${refNo.trim()}`;
	const exists = await redis.get(key);
	if (exists) return true;

	await redis.set(key, "1", { ex: 60 * 60 * 24 * 30 });
	return false;
}

/**
 * 3. Deduplikasi Fingerprint Transaksi (Masa simpan: 24 Jam)
 * Mencegah pencatatan duplikat berdasarkan Kombinasi Chat ID + Nominal + Tanggal.
 */
export async function isDuplicateGmailTx(
	chatId: number,
	nominal: number,
	tanggal: string,
): Promise<boolean> {
	const dateKey = tanggal.substring(0, 10);
	const key = `tx_dedup:${chatId}:${nominal}:${dateKey}`;

	const exists = await redis.get(key);
	if (exists) return true;

	await redis.set(key, "1", { ex: 86400 });
	return false;
}

/**
 * 4. Deduplikasi Update ID Pesan Telegram (Masa simpan: 1 Jam)
 * Mencegah webhook Telegram mengeksekusi pesan yang sama saat terjadi retry network.
 */
export async function isDuplicateMessage(updateId: number): Promise<boolean> {
	const key = `tg_msg:${updateId}`;
	const exists = await redis.get(key);
	if (exists) return true;

	await redis.set(key, "1", { ex: 3600 });
	return false;
}
