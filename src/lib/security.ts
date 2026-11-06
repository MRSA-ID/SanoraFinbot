import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// 1. Rate Limiting: Maksimal 10 request per 1 menit per User Telegram
export const ratelimit = new Ratelimit({
	redis: redis,
	limiter: Ratelimit.slidingWindow(10, "1 m"),
	analytics: true,
	prefix: "@upstash/ratelimit:telegram",
});

// 2. Blacklist Kata Kunci Prompt Injection / Exfiltration
const INJECTION_PATTERNS = [
	/system\s*prompt/i,
	/ignore\s*previous\s*instruction/i,
	/abaikan\s*instruksi/i,
	/tampilkan\s*prompt/i,
	/bocorkan\s*kunci/i,
	/secret_key/i,
	/supabase_service_role/i,
	/gemini_api_key/i,
	/siapa\s*pembuatmu/i,
	/arsitektur\s*sistem/i,
];

/**
 * Memeriksa apakah input teks mengandung pola prompt injection
 */
export function containsPromptInjection(input: string): boolean {
	return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Sanitasi teks sebelum masuk ke AI (mencegah penulisan karakter pembawa masalah)
 */
export function sanitizeInputText(input: string): string {
	return input.trim().slice(0, 1000); // Batasi maksimal 1000 karakter
}
