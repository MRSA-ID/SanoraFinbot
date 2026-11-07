/**
 * Custom Error Class untuk Error yang AMAN ditunjukkan ke pengguna Telegram.
 */
export class AppError extends Error {
	public readonly isOperational: boolean;

	constructor(message: string) {
		super(message);
		this.name = "AppError";
		this.isOperational = true; // Menandakan error ini aman dibaca user
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

/**
 * Helper untuk memindai dan memformat error sebelum dikirim ke Telegram.
 */
export function handleUserError(
	error: unknown,
	fallbackMessage = "⚠️ Terjadi gangguan teknis. Silakan coba beberapa saat lagi.",
): string {
	// Jika error adalah AppError yang sengaja kita lempar (Safe Error)
	if (error instanceof AppError) {
		return error.message;
	}

	// Tangani error umum pihak ketiga yang bisa diprediksi
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();

		// Contoh pemilahan error Gemini API / Network / File
		if (msg.includes("payload too large") || msg.includes("file size")) {
			return "⚠️ Ukuran file atau gambar terlalu besar. Harap kirimkan file yang lebih kecil.";
		}
		if (msg.includes("unsupported mime") || msg.includes("invalid format")) {
			return "⚠️ Format file tidak didukung. Harap kirimkan foto (JPG/PNG) atau dokumen PDF.";
		}
		if (msg.includes("rate limit") || msg.includes("resource exhausted")) {
			return "⚠️ Layanan AI sedang sibuk karena lalu lintas tinggi. Harap coba 1-2 menit lagi.";
		}
		if (msg.includes("quota") || msg.includes("exceeded")) {
			return "⚠️ Kuota harian pemindaian telah tercapai. Silakan coba lagi besok.";
		}
	}

	// Jika error bersifat internal/unknown (misal: Supabase connection failed, Gemini crash, Redis error)
	// Catat log detail di server untuk developer, tapi tampilkan pesan aman ke user
	console.error("🔴 [INTERNAL UNHANDLED ERROR]:", error);
	return fallbackMessage;
}
