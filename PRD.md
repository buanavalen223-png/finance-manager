# PRD.md — Product Requirements Document: Finora AI

- **Nama Produk**: Finora AI
- **Kategori Produk**: Aplikasi Web Pengelola Keuangan Pribadi Universal dengan AI Assistant
- **Status Dokumen**: BASELINE (Seluruh fitur saat ini berstatus `PLANNED`)
- **Pembaruan Terakhir**: 2026-10-26

---

## 1. Product Vision & Problem Statement

### 1.1 Product Vision
Menjadi aplikasi web pengelola keuangan pribadi universal yang elegan, tepercaya, dan mudah digunakan oleh siapa saja—menggabungkan pencatatan keuangan yang akurat dan disiplin dengan kecerdasan asisten AI yang membantu pengguna mencatat transaksi lebih cepat dan memahami kondisi finansial mereka secara jernih.

### 1.2 Problem Statement
Banyak individu (pelajar, mahasiswa, pekerja, keluarga, hingga freelancer) kesulitan mempertahankan kebiasaan mencatat dan merencanakan keuangan karena:
1. **Friksi Pencatatan Manual**: Mengisi banyak kolom form untuk setiap transaksi terasa melelahkan sehingga pencatatan sering terlewat.
2. **Fragmentasi Dompet & Kewajiban**: Uang tersebar di berbagai rekening bank, e-wallet, dan kas tunai, ditambah adanya utang/piutang, tagihan rutin, dan target tabungan yang sulit dipantau dalam satu tampilan terpadu.
3. **Antarmuka yang Rumit atau Kaku**: Aplikasi akuntansi terlalu teknis bagi pengguna awam, sementara aplikasi pencatat sederhana sering kali tidak menjaga konsistensi saldo antar-rekening atau kurang memberikan wawasan yang dapat ditindaklanjuti.
4. **Risiko Otomatisasi Buta**: Pengguna menginginkan bantuan AI untuk mempercepat input dan analisis, tetapi tetap membutuhkan kendali penuh agar AI tidak mengubah data keuangan secara salah tanpa persetujuan mereka.

---

## 2. Kamus Istilah & Penamaan Modul (Cross-Model Glossary)

Seluruh AI coding agent wajib menggunakan istilah domain dan penamaan entitas berikut secara konsisten di dokumentasi, skema database, tipe TypeScript, dan UI:

| Istilah UI (ID) | Istilah Teknis / Domain (EN) | Definisi Singkat |
| :--- | :--- | :--- |
| **Pengguna & Profil** | `Profile` (`profiles`) | Data identitas dan preferensi pengguna (mata uang utama, tema, zona waktu) yang terhubung 1:1 dengan `auth.users`. |
| **Rekening / Dompet** | `Wallet` / `Account` (`wallets`) | Wadah penyimpanan dana pengguna (Bank, E-Wallet, Tunai/Cash, Kartu/Lainnya) dengan saldo berjalan (`balance`). |
| **Kategori Transaksi** | `Category` (`categories`) | Klasifikasi transaksi bertipe `income` (pemasukan) atau `expense` (pengeluaran), baik bawaan sistem maupun kustom milik pengguna. |
| **Transaksi** | `Transaction` (`transactions`) | Catatan mutasi keuangan (`income`, `expense`, atau `transfer`). |
| **Anggaran** | `Budget` (`budgets`) | Batas alokasi pengeluaran pada kategori dan periode tertentu (bulanan/kustom). |
| **Target Tabungan** | `SavingsGoal` (`savings_goals`) | Target pengumpulan dana untuk tujuan tertentu beserta progres alokasi dananya. |
| **Utang / Piutang** | `DebtRecord` (`debts`) | Catatan kewajiban utang (`payable` / pengguna berutang) atau piutang (`receivable` / pihak lain berutang kepada pengguna) beserta riwayat cicilan/pelunasan (`debt_payments`). |
| **Tagihan & Transaksi Berulang** | `RecurringBill` (`recurring_bills`) | Jadwal tagihan atau transaksi berulang (harian, mingguan, bulanan, tahunan) yang mengingatkan atau memicu pencatatan transaksi. |
| **Draf Transaksi AI** | `AITransactionDraft` | Objek draf transaksi terstruktur hasil ekstraksi bahasa alami oleh AI yang **belum** disimpan ke tabel `transactions` sebelum dikonfirmasi pengguna. |

---

## 3. Target Users & Use Cases

| Segmen Pengguna | Karakteristik & Kebutuhan Utama | Contoh Use Case di Finora AI |
| :--- | :--- | :--- |
| **Pelajar & Mahasiswa** | Uang saku bulanan terbatas, banyak transaksi kecil harian (makan, transportasi, patungan teman). | Mencatat pengeluaran harian dengan cepat via chat AI ("Makan siang 25rb pakai GoPay"), memantau sisa anggaran bulanan, dan mencatat piutang patungan teman. |
| **Pekerja Kantoran** | Gaji bulanan tetap, memiliki tagihan rutin (listrik, internet, kos/KPR), dan target tabungan/dana darurat. | Mengelola jadwal tagihan berulang, memisahkan rekening gaji dan rekening belanja (transfer antar-dompet), serta memantau progres dana darurat. |
| **Keluarga / Rumah Tangga** | Banyak pos pengeluaran rumah tangga, anggaran belanja bulanan ketat, perencanaan biaya pendidikan/liburan. | Mengelompokkan pengeluaran per kategori rumah tangga, mengecek peringatan anggaran (budget alert) saat mendekati batas, dan mengekspor laporan bulanan. |
| **Freelancer & Pekerja Lepas** | Pemasukan tidak menentu dari berbagai klien, perlu memantau tagihan klien (piutang) dan arus kas bersih. | Mencatat pemasukan proyek dari berbagai sumber, melacak piutang belum dibayar, dan bertanya ke AI Assistant mengenai rata-rata pengeluaran bulanan vs arus kas masuk. |
| **Pengguna Umum** | Menginginkan aplikasi pencatat keuangan yang bersih, cepat, aman, di desktop maupun HP. | Melihat ringkasan kekayaan bersih (total saldo aktif vs kewajiban), berganti tema terang/gelap, dan mencadangkan data ke CSV. |

---

## 4. Functional Requirements (Spesifikasi Fitur Inti)

Semua fitur di bawah ini saat ini berstatus **`PLANNED`**.

### FR-01: Authentication & Profil (`auth`, `profiles`)
- Pengguna dapat mendaftar (Sign Up), masuk (Sign In) dengan email & password, keluar (Sign Out), dan mereset password melalui Supabase Auth.
- Saat pertama kali masuk, sistem memastikan profil pengguna terbentuk beserta kategori transaksi dasar (default categories) dan opsi pembuatan dompet pertama (onboarding singkat).
- Pengguna dapat memperbarui profil: nama tampilan, mata uang default (default: `IDR`), format tanggal, dan preferensi tema (`light` / `dark` / `system`).

### FR-02: Dashboard Keuangan (`dashboard`)
- Menampilkan ringkasan posisi keuangan periode terpilih (default: bulan berjalan):
  - Total Saldo Seluruh Rekening/Dompet aktif.
  - Total Pemasukan, Total Pengeluaran, dan Arus Kas Bersih (*Net Cashflow*) bulan berjalan.
- Menampilkan grafik tren arus kas (Pemasukan vs Pengeluaran) dan komposisi pengeluaran per kategori menggunakan `Recharts`.
- Menampilkan widget ringkas: transaksi terbaru, status anggaran teratas, tagihan jatuh tempo terdekat, dan progres target tabungan.
- Menyediakan tombol aksi cepat (*Quick Action*) untuk menambah transaksi atau membuat draf transaksi dengan AI.

### FR-03: Rekening / Dompet (`wallets`)
- Pengguna dapat membuat, melihat, mengubah, mengarsipkan (*soft archive*), atau menghapus rekening/dompet (jika belum memiliki riwayat transaksi atau melalui konfirmasi yang menjaga integritas data).
- Atribut dompet: nama dompet, tipe (`cash`, `bank`, `ewallet`, `investment`, `other`), mata uang, saldo awal (`initial_balance`), saldo saat ini (`current_balance`), warna/ikon, dan status aktif (`is_archived`).
- Pengguna dapat melakukan penyesuaian saldo (*balance adjustment*) yang secara otomatis tercatat sebagai transaksi penyesuaian agar jejak audit saldo tetap konsisten.

### FR-04: Kategori Transaksi (`categories`)
- Mendukung dua tipe kategori: `income` dan `expense`.
- Menyediakan daftar kategori bawaan saat inisialisasi akun (mis. Gaji, Bonus, Makanan & Minuman, Transportasi, Tagihan, Belanja, Kesehatan, Pendidikan, Hiburan, Lainnya).
- Pengguna dapat menambah, mengubah nama/ikon/warna, dan mengarsipkan kategori kustom. Kategori yang sudah digunakan oleh transaksi tidak boleh dihapus secara kasar (*hard delete* tanpa penanganan referensi).

### FR-05: Pemasukan, Pengeluaran, dan Transfer (`transactions`)
- Mendukung tiga jenis transaksi:
  1. **Pemasukan (`income`)**: Menambah saldo pada `wallet_id` terkait dan membutuhkan `category_id` bertipe `income`.
  2. **Pengeluaran (`expense`)**: Mengurangi saldo pada `wallet_id` terkait dan membutuhkan `category_id` bertipe `expense`.
  3. **Transfer (`transfer`)**: Memindahkan dana dari `wallet_id` (rekening asal) ke `destination_wallet_id` (rekening tujuan) secara atomik tanpa dihitung sebagai pemasukan/pengeluaran umum dalam laporan laba/rugi bulanan (kecuali biaya admin jika dicatat terpisah).
- Mendukung pencarian, pemfilteran (berdasarkan rentang tanggal, tipe, dompet, kategori, kata kunci), pengurutan, edit transaksi, dan hapus transaksi.

### FR-06: Anggaran (`budgets`)
- Pengguna dapat menetapkan batas anggaran pengeluaran untuk kategori `expense` tertentu (atau total keseluruhan) pada periode bulanan.
- Sistem menghitung realisasi pengeluaran secara otomatis dari transaksi bertipe `expense` yang cocok dengan kategori dan periode anggaran.
- Menampilkan indikator visual progres pemakaian anggaran:
  - Aman (`< 80%`)
  - Peringatan / Hati-hati (`80% – 99%`)
  - Melebihi Anggaran (`>= 100%`)

### FR-07: Target Tabungan (`savings_goals`)
- Pengguna dapat membuat target tabungan dengan atribut: nama target, nominal target (`target_amount`), nominal terkumpul saat ini (`current_amount`), tenggat waktu opsional (`target_date`), dompet penampung opsional, dan catatan.
- Pengguna dapat menambah alokasi dana (*contribute*) atau menarik dana (*withdraw*) dari target tabungan, baik sebagai pencatatan alokasi maupun terhubung dengan transaksi/dompet.

### FR-08: Utang / Piutang (`debts`, `debt_payments`)
- Pengguna dapat mencatat:
  - **Utang (`payable`)**: Kewajiban pengguna kepada pihak lain.
  - **Piutang (`receivable`)**: Hak tagih pengguna kepada pihak lain.
- Atribut: nama pihak terkait (`counterparty_name`), tipe (`payable`/`receivable`), total nominal awal (`principal_amount`), sisa nominal (`remaining_amount`), tanggal jatuh tempo (`due_date`), status (`unpaid`, `partial`, `paid`), dan catatan.
- Pengguna dapat mencatat pembayaran/cicilan sebagian maupun pelunasan penuh (`debt_payments`), dengan opsi memilih dompet sumber/tujuan sehingga saldo dompet dan sisa utang/piutang diperbarui secara konsisten.

### FR-09: Tagihan & Transaksi Berulang (`recurring_bills`)
- Pengguna dapat mendaftarkan tagihan rutin atau pemasukan/pengeluaran berulang (frekuensi: `daily`, `weekly`, `monthly`, `yearly`).
- Menampilkan daftar tagihan yang akan jatuh tempo (*Upcoming*) dan yang sudah lewat jatuh tempo (*Overdue*).
- Pengguna dapat menandai tagihan sebagai "Sudah Dibayar / Catat Sekarang" (*Record Execution*), yang secara otomatis membuat transaksi riil pada dompet terpilih dan memajukan `next_due_date` ke siklus berikutnya.

### FR-10: Laporan & Ekspor Data (`reports`)
- Menyediakan laporan analitik berdasarkan periode (mingguan, bulanan, tahunan, rentang tanggal kustom):
  - Ringkasan Pemasukan vs Pengeluaran.
  - Rincian pengeluaran dan pemasukan per kategori (persentase dan nominal).
  - Arus kas per dompet.
- Fitur **Ekspor Data (CSV)**: Pengguna dapat mengunduh data transaksi yang difilter ke dalam format file `.csv` standar yang rapi dan siap dibuka di aplikasi spreadsheet.

### FR-11: AI Financial Assistant (`ai-assistant`)
- Antarmuka percakapan kontekstual tempat pengguna dapat bertanya tentang kondisi keuangan mereka (mis. *"Berapa total pengeluaranku untuk makan bulan ini?"*, *"Apakah anggaranku bulan ini masih aman?"*, *"Bantu buat rencana pelunasan utang"*).
- Konteks finansial pengguna (ringkasan saldo, anggaran, agregasi kategori periode aktif) dikirim secara aman melalui endpoint server-side ke AI provider tanpa membocorkan data pengguna lain.
- Jika AI gateway belum dikonfigurasi atau sedang tidak tersedia, UI menampilkan status yang jelas dan jujur tanpa membuat aplikasi crash.

### FR-12: AI Transaction Drafting dengan Konfirmasi Pengguna (`ai-drafting`)
- Pengguna dapat mengetik kalimat bebas (natural language) seperti:
  - *"Beli kopi 32.000 dan roti 18.000 tadi pagi pakai BCA"*
  - *"Terima pembayaran proyek desain 2,5 juta ke Mandiri"*
  - *"Transfer 500 ribu dari BCA ke GoPay"*
- AI mengekstrak input tersebut menjadi satu atau lebih **Draf Transaksi Terstruktur (`AITransactionDraft`)** berisi: tipe transaksi, nominal, tebakan kategori (dicocokkan dengan daftar kategori pengguna), tebakan dompet (dicocokkan dengan daftar dompet pengguna), tanggal, dan deskripsi.
- **Konfirmasi Pengguna Wajib**: Sistem menampilkan kartu/modal pratinjau draf (*Review & Confirm*). Pengguna dapat mengubah field yang kurang tepat, menghapus item draf, atau menekan tombol **Konfirmasi & Simpan** untuk mengeksekusi penyimpanan transaksi resmi.

---

## 5. Non-Functional Requirements & Design Direction

### 5.1 Design Direction: Minimalist Premium Fintech
- **Estetika**: Bersih, tenang, profesional, memiliki ruang kosong (*whitespace*) yang lega, hierarki tipografi yang tegas, dan fokus pada keterbacaan angka finansial.
- **Palet Warna Inti**:
  - **Primary Background (Light)**: Warm off-white `#F7F7F2`
  - **Primary Brand / Accent**: Emerald `#176B52`
  - **Primary Text / Dark Surface**: Charcoal `#222824`
  - **Secondary Surface / Soft Highlight**: Soft green `#DDECE4`
  - **Semantic Colors**:
    - Pemasukan / Positif: Bernuansa Emerald / Hijau terukur.
    - Pengeluaran / Bahaya / Over-budget: Merah terukur yang tetap harmonis dan memenuhi rasio kontras aksesibilitas.
    - Peringatan / Mendekati batas: Amber / Kuning hangat.
- **Tema (Light / Dark Mode)**:
  - Mendukung tema Terang (*Light*) dan Gelap (*Dark*) menggunakan variabel CSS / Tailwind token yang konsisten.
  - Pada mode gelap, gunakan turunan warna dasar `#222824` (Charcoal gelap) sebagai surface latar dengan aksen `#DDECE4` / Emerald cerah agar kontras tetap nyaman di mata.
- **Tipografi & Format Angka**:
  - Gunakan font sans-serif modern yang bersih dan mudah dibaca, serta aktifkan `tabular-nums` (`font-variant-numeric: tabular-nums`) pada seluruh nominal uang, tabel transaksi, dan persentase agar sejajar secara vertikal.
- **Animasi & Aksesibilitas**:
  - Animasi minimal dan fungsional (transisi halus 150–200ms, menghormati `prefers-reduced-motion`).
  - Komponen interaktif dapat diakses dengan keyboard (*focus ring* terlihat jelas, label `aria-*` pada tombol ikon, modal dialog dengan *focus trap*).
  - Responsif penuh untuk layar Desktop (navigasi sidebar) dan Mobile (navigasi bawah / *bottom navigation* atau *drawer* yang ergonomis).

### 5.2 Performa, Keandalan & Kualitas
- Validasi form dilakukan di sisi klien menggunakan `React Hook Form` + `Zod` dengan pesan error berbahasa Indonesia yang ramah dan jelas.
- Seluruh state loading, empty state (ketika belum ada data), dan error state wajib dirancang dengan baik—tidak boleh menampilkan layar putih kosong (*blank screen*).

---

## 6. User Flows Utama

1. **Alur Onboarding Pengguna Baru**:
   Registrasi / Login $\rightarrow$ Pembuatan profil & kategori default otomatis $\rightarrow$ Prompt membuat Dompet Pertama (mis. "Kas Tunai" atau "Rekening Utama" beserta saldo awal) $\rightarrow$ Masuk ke Dashboard.
2. **Alur Pencatatan Transaksi Manual**:
   Klik "Tambah Transaksi" $\rightarrow$ Pilih tipe (`Expense` / `Income` / `Transfer`) $\rightarrow$ Isi nominal, pilih dompet (dan dompet tujuan jika transfer), pilih kategori, tanggal, catatan $\rightarrow$ Validasi Zod $\rightarrow$ Eksekusi transaksi atomik ke Supabase $\rightarrow$ Saldo dompet, daftar transaksi, anggaran, dan dashboard diperbarui.
3. **Alur AI Transaction Drafting (Human-in-the-Loop)**:
   Pengguna memasukkan teks bebas di panel AI $\rightarrow$ Frontend mengirim teks + daftar nama/ID dompet & kategori pengguna ke endpoint server-side $\rightarrow$ Endpoint memanggil AI gateway dan memvalidasi output JSON dengan Zod $\rightarrow$ Frontend merender kartu *Draft Preview* $\rightarrow$ Pengguna memeriksa/mengoreksi field $\rightarrow$ Pengguna klik **Simpan Transaksi** $\rightarrow$ Memanggil service penyimpanan transaksi standar.
4. **Alur Pembayaran Utang / Piutang**:
   Buka detail catatan Utang/Piutang $\rightarrow$ Klik "Catat Pembayaran" $\rightarrow$ Masukkan nominal bayar dan pilih dompet (opsional/terhubung) $\rightarrow$ Sisa utang/piutang berkurang (dan status otomatis menjadi `paid` jika sisa `= 0`), serta mutasi saldo dompet tercatat secara konsisten.

---

## 7. Business Rules Keuangan (Financial Invariants)

Aturan bisnis ini mengikat seluruh implementasi logika domain dan database:

1. **Presisi Nominal & Aritmetika Integer Rupiah**:
   - Semua nominal transaksi, anggaran, target tabungan, dan pembayaran utang harus bernilai integer Rupiah positif (`amount > 0`).
   - Dilarang menggunakan perhitungan floating-point kasar untuk aritmetika keuangan. Gunakan tipe `BIGINT` di database PostgreSQL untuk menyimpan nilai integer Rupiah (satuan terkecil Rp 1) dan fungsi integer aman (`toSafeRupiahInteger`) di TypeScript, dengan pemformatan mata uang IDR berstandar locale `id-ID`.
2. **Invariant Saldo Rekening (`Wallet Balance Invariant`)**:
   - Untuk setiap dompet, perubahan transaksi harus selalu menjaga persamaan:
     $$\text{Current Balance} = \text{Initial Balance} + \sum \text{Income} - \sum \text{Expense} - \sum \text{Transfer Out} + \sum \text{Transfer In}$$
   - **Saat Transaksi Dibuat (`INSERT`)**:
     - `income`: `wallet.current_balance += amount`
     - `expense`: `wallet.current_balance -= amount`
     - `transfer`: `source_wallet.current_balance -= amount` dan `destination_wallet.current_balance += amount` (tidak boleh `source_wallet_id == destination_wallet_id`).
   - **Saat Transaksi Diubah (`UPDATE`)**:
     - Efek transaksi lama harus dibatalkan (*reverted*) pada dompet lama, dan efek transaksi baru diterapkan pada dompet baru dalam satu transaksi database atomik.
   - **Saat Transaksi Dihapus (`DELETE`)**:
     - Efek transaksi terhadap saldo dompet harus dibatalkan (*reverted*) secara atomik sebelum baris transaksi dihapus.
3. **Aturan Transfer Antar-Dompet**:
   - Transaksi bertipe `transfer` **tidak boleh** dihitung sebagai pemasukan maupun pengeluaran dalam agregasi laporan Laba/Rugi (Total Pemasukan vs Total Pengeluaran) atau realisasi Anggaran kategori, agar tidak menggelembungkan arus kas secara semu.
4. **Aturan Utang / Piutang**:
   - Nominal pembayaran (`payment_amount`) tidak boleh melebihi sisa kewajiban (`remaining_amount`) kecuali dikonfirmasi secara eksplisit, dan `remaining_amount` tidak boleh menjadi negatif (`< 0`).
   - Status otomatis: `remaining_amount == principal_amount` $\rightarrow$ `unpaid`; `0 < remaining_amount < principal_amount` $\rightarrow$ `partial`; `remaining_amount == 0` $\rightarrow$ `paid`.

---

## 8. AI Requirements & Batasan

1. **Abstraksi Provider**:
   - Sistem menggunakan arsitektur **Server-Side AI Provider Abstraction** yang kompatibel dengan spesifikasi OpenAI Chat Completions / Structured Outputs sehingga dapat diarahkan ke **9Router**, **OpenRouter**, atau provider OpenAI-compatible lainnya hanya melalui konfigurasi environment server.
   - **Penting**: Jangan mengasumsikan provider, endpoint URL, nama model, harga, atau ketersediaan API sudah aktif sebelum kredensial environment diverifikasi.
2. **Batasan Otoritas AI**:
   - AI **hanya** memiliki akses baca terhadap ringkasan konteks finansial yang dikirim oleh server untuk pengguna yang sedang terautentikasi.
   - AI **tidak pernah** mengeksekusi query SQL langsung dan **tidak pernah** memodifikasi tabel database tanpa interaksi konfirmasi pengguna di UI.
3. **Fallback & Graceful Degradation**:
   - Seluruh fitur inti pencatatan keuangan manual, dashboard, anggaran, tabungan, utang/piutang, tagihan berulang, dan laporan/ekspor **wajib tetap berfungsi 100%** meskipun layanan AI belum dikonfigurasi atau sedang mengalami gangguan.

---

## 9. Security & Privacy Requirements

1. **Row Level Security (RLS) Wajib**: Seluruh tabel di skema `public` wajib mengaktifkan RLS dengan pemeriksaan `auth.uid() = user_id`.
2. **Isolasi Secret**: API key AI gateway hanya boleh diakses di runtime server-side (mis. Vercel Serverless/Edge Functions atau Supabase Edge Functions) dan dilarang keras diberi prefix `VITE_`.
3. **Validasi Input Berlapis**: Setiap input divalidasi di frontend (Zod) dan divalidasi ulang oleh constraint database (`CHECK (amount > 0)`, foreign key milik `user_id` yang sama) serta endpoint server.
4. **Sanitasi Output AI**: Output teks maupun JSON dari AI wajib di-parse dengan aman dan dirender sebagai teks ter-escape (bukan `dangerouslySetInnerHTML` mentah) untuk mencegah XSS.

---

## 10. Acceptance Criteria Setiap Modul

| Modul | Acceptance Criteria Utama |
| :--- | :--- |
| **Auth & Profil** | Pengguna dapat daftar, login, logout; rute privat terlindungi; profil & kategori awal terbuat otomatis; preferensi tema & mata uang tersimpan. |
| **Rekening / Dompet** | CRUD dompet berfungsi; saldo awal tercatat; arsip dompet berfungsi; saldo dompet selalu akurat mengikuti mutasi transaksi. |
| **Kategori Transaksi** | Kategori default tersedia; pengguna dapat menambah/mengedit kategori `income` dan `expense`; filter tipe kategori sesuai jenis transaksi. |
| **Transaksi (In/Out/Transfer)** | Input pemasukan, pengeluaran, dan transfer memperbarui saldo dompet secara atomik; edit dan hapus transaksi mengembalikan saldo dengan tepat; filter & pencarian akurat. |
| **Dashboard Keuangan** | Menampilkan total saldo, pemasukan, pengeluaran, net cashflow, grafik Recharts, dan transaksi terbaru sesuai data aktual tanpa angka hardcode. |
| **Anggaran** | Pengguna dapat membuat/mengedit anggaran bulanan per kategori; progres bar dan persentase dihitung akurat dari transaksi `expense` periode tersebut. |
| **Target Tabungan** | CRUD target tabungan berfungsi; penambahan/penarikan alokasi dana memperbarui progres dan persentase pencapaian dengan benar. |
| **Utang / Piutang** | CRUD catatan utang & piutang; pencatatan cicilan/pelunasan mengurangi sisa nominal, memperbarui status (`unpaid`/`partial`/`paid`), dan opsional memutasi saldo dompet. |
| **Tagihan Berulang** | CRUD jadwal tagihan; indikator jatuh tempo akurat; aksi "Catat Pembayaran" membuat transaksi riil dan memajukan tanggal jatuh tempo berikutnya. |
| **Laporan & Ekspor Data** | Grafik dan tabel ringkasan periode sesuai filter tanggal; tombol ekspor menghasilkan file `.csv` yang valid dari data transaksi terfilter. |
| **AI Financial Assistant** | Mengirim pesan lewat endpoint server-side; respons relevan dengan konteks keuangan pengguna; menampilkan pesan status yang sopan jika API key belum diatur. |
| **AI Transaction Drafting** | Input kalimat alami menghasilkan draf transaksi terstruktur; pengguna dapat mengedit draf di UI dan harus menekan tombol konfirmasi sebelum transaksi tersimpan ke DB. |

---

## 11. Cakupan Produk (MVP, Post-MVP, dan Out of Scope)

### 11.1 MVP Scope (Target Rilis Utama)
Seluruh 12 fitur inti pada Bagian 4 dalam bentuk yang solid, aman, dan terintegrasi penuh:
- Autentikasi & Profil pengguna + Dark/Light mode.
- Manajemen Rekening/Dompet & Kategori Transaksi.
- Pencatatan Pemasukan, Pengeluaran, dan Transfer secara atomik.
- Dashboard Keuangan interaktif dengan grafik Recharts.
- Manajemen Anggaran bulanan, Target Tabungan, Utang/Piutang, serta Tagihan Berulang.
- Laporan keuangan periodik & Ekspor CSV.
- AI Financial Assistant & AI Transaction Drafting (dengan konfirmasi pengguna) melalui abstraksi server-side.

### 11.2 Post-MVP Scope (Pengembangan Tahap Berikutnya)
- Pemindaian struk belanja berbasis gambar/OCR (*Receipt Image Scanning*).
- Dukungan multi-mata uang dengan konversi kurs otomatis (*real-time FX rates*).
- Kolaborasi dompet/anggaran bersama keluarga (*Shared Household Workspaces*).
- Ekspor laporan dalam format PDF cetak berdesain khusus.
- Notifikasi email/push otomatis untuk pengingat tagihan jatuh tempo.

### 11.3 Belum Direncanakan / Out of Scope
- Integrasi mutasi bank otomatis (*Direct Open Banking / Screen Scraping* rekening perbankan).
- Eksekusi pembayaran nyata, transfer uang antar-bank sungguhan, atau payment gateway.
- Perdagangan saham/kripto langsung atau nasihat investasi berlisensi hukum.

---

## 12. Milestone Roadmap & Acceptance Checklist

Seluruh pengembangan Finora AI dibagi ke dalam **7 Milestone Berurutan** dari fondasi hingga deployment:

### Milestone 0: Project Governance & Architecture Baseline
- **Cakupan**: Audit repositori dan penyusunan dokumen acuan (`AGENTS.md`, `PRD.md`, `HANDOFF.md`, `ARCHITECTURE.md`).
- **Acceptance Checklist**:
  - [x] `AGENTS.md`, `PRD.md`, `HANDOFF.md`, dan `ARCHITECTURE.md` tersedia dan konsisten.
  - [x] Tidak ada klaim palsu mengenai kode atau deployment yang belum ada.

### Milestone 1: Application Foundation, Design System & Routing Shell
- **Cakupan**: Inisialisasi proyek Vite + React + TypeScript (`strict`), Tailwind CSS dengan token warna Finora AI (`#F7F7F2`, `#176B52`, `#222824`, `#DDECE4`) & dukungan Light/Dark theme, komponen dasar UI (shadcn/ui), React Router layout (Sidebar desktop + Bottom nav mobile), dan konfigurasi environment client/server.
- **Acceptance Checklist**:
  - [x] `npm run typecheck`, `npm run lint`, dan `npm run build` berjalan sukses tanpa error.
  - [x] Palet warna Minimalist Premium Fintech dan toggle Light/Dark mode berfungsi.
  - [x] Kerangka navigasi responsif (Desktop & Mobile) siap digunakan.

### Milestone 2: Supabase Schema, RLS, Authentication & Onboarding
- **Cakupan**: File migrasi SQL Supabase (tabel inti, constraint, RLS policies, dan RPC atomik untuk mutasi transaksi), integrasi Supabase Auth (Login, Register, Logout, Protected Routes), manajemen Profil, dan seeding kategori default.
- **Acceptance Checklist**:
  - [x] Skrip migrasi SQL lengkap dengan RLS (`auth.uid() = user_id`) pada seluruh tabel.
  - [x] Alur Sign Up, Sign In, Sign Out, dan pembuatan profil/kategori awal berfungsi.
  - [x] Route guard menahan pengguna yang belum login.

### Milestone 3: Core Ledger — Wallets, Categories & Atomic Transactions
- **Cakupan**: Modul Rekening/Dompet (`wallets`), Kategori (`categories`), dan Transaksi (`income`, `expense`, `transfer`) lengkap dengan filter, pencarian, edit, dan hapus yang mempertahankan invariant saldo.
- **Acceptance Checklist**:
  - [x] CRUD Dompet dan Kategori berfungsi dengan validasi `React Hook Form` + `Zod`.
  - [x] Tambah, edit, dan hapus transaksi (`income`, `expense`, `transfer`) memperbarui saldo dompet secara atomik dan akurat.
  - [x] Unit test untuk logika kalkulasi dan invariant transaksi lulus.

### Milestone 4: Financial Planning — Budgets, Savings Goals, Debts & Recurring Bills
- **Cakupan**: Modul Anggaran (`budgets`), Target Tabungan (`savings_goals`), Utang/Piutang (`debts` & `debt_payments`), serta Tagihan Berulang (`recurring_bills`).
- **Acceptance Checklist**:
  - [x] Realisasi anggaran terhitung otomatis dari pengeluaran kategori terkait dan anggaran keseluruhan.
  - [x] Progres target tabungan dapat ditambah/ditarik dengan akurat beserta simulasi setoran berkala.
  - [x] Pencatatan pembayaran utang/piutang memperbarui sisa kewajiban, status lunas, dan saldo dompet (jika dipilih).
  - [x] Eksekusi tagihan berulang membuat transaksi baru dan memajukan tanggal jatuh tempo berikutnya.

### Milestone 5: Dashboard Analytics, Reports & CSV Export
- **Cakupan**: Integrasi penuh Dashboard Keuangan dengan data riil, visualisasi `Recharts`, halaman Laporan periodik, dan fitur Ekspor CSV.
- **Acceptance Checklist**:
  - [ ] Seluruh metrik dan grafik di Dashboard serta halaman Laporan mencerminkan data aktual pengguna (transfer tidak menggelembungkan income/expense).
  - [ ] Fitur Ekspor CSV mengunduh file `.csv` yang terformat rapi dan akurat sesuai filter.

### Milestone 6: Server-Side AI Provider Abstraction, AI Assistant & Transaction Drafting
- **Cakupan**: Implementasi endpoint server-side (`/api/ai/chat` dan `/api/ai/draft-transaction`) dengan abstraksi provider OpenAI-compatible (9Router / OpenRouter / lainnya), UI AI Financial Assistant, dan alur *Review & Confirm* untuk AI Transaction Drafting.
- **Acceptance Checklist**:
  - [ ] Tidak ada API key AI di kode frontend atau variabel `VITE_*`.
  - [ ] AI Transaction Drafting memvalidasi respons dengan Zod dan mewajibkan konfirmasi pengguna sebelum menyimpan ke database.
  - [ ] Penanganan error/fallback berjalan mulus jika konfigurasi AI provider belum tersedia atau gagal.

### Milestone 7: End-to-End Verification, Hardening & Deployment Readiness
- **Cakupan**: Pengujian menyeluruh, audit aksesibilitas & responsivitas mobile/desktop, konfigurasi deployment (`vercel.json` jika diperlukan), dan dokumentasi rilis.
- **Acceptance Checklist**:
  - [ ] Seluruh test suite, typecheck, linter, dan production build lulus tanpa error.
  - [ ] Seluruh RLS dan invariant saldo terverifikasi.
  - [ ] `HANDOFF.md` diperbarui dengan status akhir dan panduan konfigurasi deployment.

