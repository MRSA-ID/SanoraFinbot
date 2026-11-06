export default function HomePage() {
	return (
		<main
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: "100vh",
				fontFamily: "sans-serif",
				textAlign: "center",
				padding: "20px",
				backgroundColor: "#f8fafc",
				color: "#1e293b",
			}}>
			<div
				style={{
					maxWidth: "600px",
					backgroundColor: "#ffffff",
					padding: "40px",
					borderRadius: "16px",
					boxShadow:
						"0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
				}}>
				<h1
					style={{ fontSize: "28px", marginBottom: "16px", color: "#0f172a" }}>
					🤖 Sanora Finance AI Bot
				</h1>
				<p
					style={{
						fontSize: "16px",
						lineHeight: "1.6",
						color: "#475569",
						marginBottom: "32px",
					}}>
					Asisten keuangan pribadi cerdas yang secara otomatis mengekstrak
					transaksi dari Gmail, foto struk, dan teks, serta mencatatnya langsung
					ke Google Sheets Anda secara <i>real-time</i>.
				</p>

				<a
					href="https://t.me/SanoraFinbot"
					target="_blank"
					rel="noopener noreferrer"
					style={{
						display: "inline-block",
						padding: "14px 28px",
						backgroundColor: "#0284c7",
						color: "#ffffff",
						borderRadius: "8px",
						textDecoration: "none",
						fontWeight: "bold",
						fontSize: "16px",
						boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4)",
						transition: "background-color 0.2s",
					}}>
					Buka Bot di Telegram 🚀
				</a>

				<div
					style={{
						marginTop: "40px",
						fontSize: "14px",
						color: "#64748b",
						borderTop: "1px solid #e2e8f0",
						paddingTop: "20px",
					}}>
					<p style={{ margin: "0 0 10px 0" }}>Kebijakan & Ketentuan Layanan:</p>
					<div
						style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
						<a
							href="/privacy"
							style={{ color: "#0284c7", textDecoration: "none" }}>
							Kebijakan Privasi
						</a>
						<span>•</span>
						<a
							href="/terms"
							style={{ color: "#0284c7", textDecoration: "none" }}>
							Ketentuan Layanan
						</a>
					</div>
				</div>
			</div>
		</main>
	);
}
