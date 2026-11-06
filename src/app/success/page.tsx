"use client";

import { useEffect } from "react";

export default function SuccessPage() {
	useEffect(() => {
		// Opsional: Otomatis mencoba membuka aplikasi Telegram setelah 2 detik
		const timer = setTimeout(() => {
			window.location.href = "https://t.me/SanoraFinbot"; // Ganti NAMA_BOT_ANDA
		}, 2000);

		return () => clearTimeout(timer);
	}, []);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: "100vh",
				fontFamily: "sans-serif",
				textAlign: "center",
				padding: "20px",
			}}>
			<h1 style={{ color: "#16a34a" }}>✅ Akun Berhasil Terhubung!</h1>
			<p>Pesan konfirmasi telah dikirimkan ke Telegram Anda.</p>
			<a
				href="https://t.me/SanoraFinbot"
				style={{
					marginTop: "16px",
					padding: "12px 24px",
					backgroundColor: "#0284c7",
					color: "#ffffff",
					borderRadius: "8px",
					textDecoration: "none",
					fontWeight: "bold",
				}}>
				Kembali ke Telegram
			</a>
		</div>
	);
}
