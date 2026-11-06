export default function TermsOfServicePage() {
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
			<h1>Ketentuan Layanan (Terms of Service)</h1>
			<p>
				<strong>Terakhir diperbarui:</strong> November 2026
			</p>

			<p>
				Selamat datang di <strong>SanoraFinbot</strong>. Dengan menggunakan bot
				Telegram dan layanan web kami, Anda menyetujui syarat dan ketentuan
				berikut ini. Harap baca dengan seksama.
			</p>

			<h2>1. Penerimaan Ketentuan</h2>
			<p>
				Dengan mengakses atau menggunakan SanoraFinbot, Anda menyatakan bahwa
				Anda telah membaca, memahami, dan menyetujui untuk terikat oleh
				Ketentuan Layanan ini. Jika Anda tidak setuju, mohon untuk tidak
				menggunakan layanan ini.
			</p>

			<h2>2. Deskripsi Layanan</h2>
			<p>
				SanoraFinbot adalah asisten keuangan pribadi otomatis yang membantu
				mengekstrak data transaksi dari email Gmail, teks, foto struk, atau
				dokumen mutasi, dan menyimpannya ke dalam Google Spreadsheet pribadi
				pengguna.
			</p>

			<h2>3. Tanggung jawab Pengguna</h2>
			<ul>
				<li>
					Anda bertanggung jawab penuh atas kerahasiaan akun Telegram dan akses
					Google Anda.
				</li>
				<li>
					Anda setuju untuk tidak menggunakan bot ini untuk aktivitas yang
					melanggar hukum atau mencoba melakukan rekayasa balik (reverse
					engineering) / eksploitasi sistem (seperti prompt injection).
				</li>
				<li>
					Akurasi pencatatan keuangan yang dihasilkan oleh AI tetap memerlukan
					verifikasi mandiri oleh pengguna pada Google Sheets masing-masing.
				</li>
			</ul>

			<h2>4. Batasan Tanggung Jawab</h2>
			<p>
				Layanan ini disediakan &quot;sebagaimana adanya&quot; tanpa garansi
				dalam bentuk apa pun. Pengembang tidak bertanggung jawab atas kerugian
				finansial, kesalahan pembacaan data oleh AI, atau gangguan teknis yang
				disebabkan oleh layanan pihak ketiga (seperti Google API, Telegram, atau
				Supabase).
			</p>

			<h2>5. Perubahan Ketentuan</h2>
			<p>
				Kami berhak mengubah atau memperbarui Ketentuan Layanan ini
				sewaktu-waktu. Perubahan akan berlaku segera setelah dipublikasikan pada
				halaman ini.
			</p>
		</main>
	);
}
