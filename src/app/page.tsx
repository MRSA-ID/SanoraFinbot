import { redirect } from "next/navigation";

export default function HomePage() {
	// Otomatis mengarahkan pengunjung ke Telegram Bot saat mengakses domain utama
	redirect("https://t.me/SanoraFinbot");
}
