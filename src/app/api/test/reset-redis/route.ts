import { NextResponse } from "next/server";
import { redis } from "@/src/lib/redis";

export async function GET() {
	try {
		// Menghapus seluruh cache deduplikasi di Redis
		await redis.flushdb();
		return NextResponse.json({
			success: true,
			message:
				"Cache deduplikasi Redis berhasil dibersihkan! Anda bisa tes cron sync kembali.",
		});
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
