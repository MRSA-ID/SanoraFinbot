export default function PrivacyPolicyPage() {
	return (
		<main
			style={{
				maxWidth: "800px",
				margin: "40px auto",
				padding: "0 20px",
				fontFamily: "sans-serif",
				lineHeight: 1.6,
				color: "#333",
			}}>
			<h1>Kebijakan Privasi (Privacy Policy)</h1>
			<p>
				<strong>Terakhir diperbarui:</strong> November 2026
			</p>

			<p>
				<strong>SanoraFinbot</strong> (&quot;kami&quot;) berkomitmen untuk
				melindungi privasi Anda. Kebijakan Privasi ini menjelaskan bagaimana
				aplikasi kami mengumpulkan, menggunakan, dan melindungi informasi Anda
				saat menggunakan bot Telegram dan layanan terkait.
			</p>

			<h2>1. Informasi yang Kami Kumpulkan</h2>
			<p>
				Untuk menjalankan fungsinya sebagai asisten keuangan pribadi, aplikasi
				kami mengakses data berikut:
			</p>
			<ul>
				<li>
					<strong>Informasi Akun Google & Gmail:</strong> Saat Anda
					menghubungkan akun Google (OAuth), kami mengakses alamat email Anda
					dan membaca pesan email masuk yang relevan dengan transaksi keuangan
					(seperti dari bank, e-wallet, QRIS, atau merchant resmi) guna
					melakukan sinkronisasi otomatis.
				</li>
				<li>
					<strong>Google Drive & Sheets:</strong> Aplikasi kami membuat file
					Google Spreadsheet baru di Google Drive Anda untuk menyimpan catatan
					transaksi Anda secara mandiri.
				</li>
				<li>
					<strong>Data Transaksi & Interaksi Telegram:</strong> Pesan teks, foto
					struk, atau dokumen mutasi rekening yang Anda kirimkan melalui
					Telegram diproses sementara untuk ekstraksi data.
				</li>
			</ul>

			<h2>2. Penggunaan Data</h2>
			<p>Data yang dikumpulkan hanya digunakan untuk:</p>
			<ul>
				<li>
					Mengekstrak informasi transaksi menggunakan kecerdasan buatan (Google
					Gemini AI).
				</li>
				<li>
					Mencatat dan memperbarui laporan keuangan di Google Sheets pribadi
					Anda.
				</li>
				<li>
					Mengirimkan notifikasi ringkasan transaksi ke akun Telegram Anda.
				</li>
			</ul>

			<h2>3. Keamanan & Penyimpanan Data</h2>
			<p>
				Token akses Google (Refresh Token) Anda dienkripsi secara aman
				menggunakan protokol enkripsi standar industri sebelum disimpan di
				database kami (Supabase). Kami <strong>tidak pernah</strong>{" "}
				memperjualbelikan, membagikan, atau menyalahgunakan data keuangan atau
				email pribadi Anda kepada pihak ketiga mana pun.
			</p>

			<h2>4. Hak Kontrol Pengguna (Disconnect & Delete)</h2>
			<p>Anda memiliki kendali penuh atas data Anda:</p>
			<ul>
				<li>
					Ketik perintah <code>/disconnect</code> di bot Telegram kapan saja
					untuk mencabut akses Google OAuth dan kembali ke Mode Guest.
				</li>
				<li>
					Ketik perintah <code>/deleteaccount</code> di bot Telegram untuk
					menghapus seluruh data pendaftaran Anda dari database kami secara
					permanen.
				</li>
			</ul>

			<h2>5. Kontak Kami</h2>
			<p>
				Jika ada pertanyaan mengenai kebijakan privasi ini, Anda dapat
				menghubungi pengembang melalui repository atau kontak dukungan terkait.
			</p>
		</main>
	);
}
