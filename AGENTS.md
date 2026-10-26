# AGENTS.md — Finora AI Permanent Operating Manual for AI Coding Agents

Dokumen ini berisi instruksi kerja permanen dan mengikat untuk seluruh AI coding agent (lintas model dan sesi) yang bekerja pada repositori **Finora AI**. Jangan menyalin spesifikasi produk lengkap ke file ini; gunakan dokumen ini sebagai aturan tata kelola eksekusi.

---

## 1. Urutan Baca Wajib Sebelum Eksekusi (Mandatory Pre-Flight Reading)

Sebelum memulai analisis, merancang perubahan, atau menulis kode pada task apa pun, setiap AI agent **WAJIB** membaca dokumen berikut secara berurutan:

1. **`AGENTS.md`** — Aturan kerja permanen, batasan keamanan, dan protokol handoff.
2. **`HANDOFF.md`** — Status proyek aktual saat ini, milestone aktif, file yang sudah ada, dan task berikutnya.
3. **`PRD.md`** — Spesifikasi produk, aturan bisnis keuangan, cakupan fitur (MVP vs Post-MVP), dan acceptance criteria.
4. **`ARCHITECTURE.md`** — Desain teknis, struktur direktori, skema data & invariant transaksi, integrasi Supabase/RLS, dan abstraksi AI provider.

---

## 2. Audit Repositori & Perlindungan Pekerjaan

1. **Periksa Kondisi Aktual**: Selalu jalankan pengecekan file dan `git status` / `git diff` (jika Git sudah diinisialisasi) sebelum menyentuh kode.
2. **Jangan Menimpa Tanpa Alasan**: Dilarang menghapus pekerjaan pengguna, merombak struktur yang sudah berjalan benar, atau menimpa implementasi yang valid tanpa alasan teknis yang jelas dan terdokumentasi.
3. **Hormati Uncommitted Changes**: Jika terdapat perubahan yang belum di-commit, analisis apakah perubahan tersebut bagian dari task yang sedang berjalan sebelum melakukan modifikasi.
4. **Batasi Scope Perubahan**: Kerjakan **hanya** apa yang diminta pada scope task/milestone aktif. Jangan melakukan refactoring melebar atau menambahkan fitur di luar instruksi aktif.

---

## 3. Aturan Teknis & Arsitektur

1. **Kepatuhan Stack**: Gunakan stack yang telah disepakati di `ARCHITECTURE.md` (React, TypeScript, Vite, Tailwind CSS, shadcn/ui seperlunya, React Router, Lucide React, Recharts, Supabase Auth + PostgreSQL + RLS, React Hook Form + Zod, Server-side AI provider abstraction).
2. **Disiplin Dependency**: Hindari menambahkan library atau package baru yang tidak diperlukan jika kebutuhan dapat diselesaikan dengan stack utama atau Web API standar. Setiap penambahan dependency wajib memiliki justifikasi kuat dan dicatat di `HANDOFF.md`.
3. **Strict TypeScript**:
   - Gunakan `strict: true` pada konfigurasi TypeScript.
   - Hindari penggunaan `any`, `@ts-ignore`, atau type casting tidak aman (`as unknown as ...`) kecuali benar-benar tidak terhindarkan dan disertai komentar alasan teknis.
   - Gunakan skema `Zod` sebagai sumber kebenaran validasi runtime sekaligus inferensi tipe (`z.infer`).
4. **Pemisahan Tanggung Jawab (Separation of Concerns)**:
   - **UI Layer (`components/`, `pages/`)**: Fokus pada presentasi, interaksi pengguna, dan aksesibilitas. Tidak boleh berisi query database langsung atau kalkulasi mutasi saldo mentah.
   - **Validation Layer (`schemas/`)**: Skema Zod untuk form input, payload API, dan structured output AI.
   - **Business Logic / Domain Services (`services/`, `lib/finance/`)**: Aturan bisnis keuangan, kalkulasi anggaran, validasi invariant transaksi, dan orkestrasi alur.
   - **Data Access Layer (`repositories/` atau `api/` / Supabase client hooks)**: Query ke Supabase PostgreSQL dan pemanggilan endpoint server-side.
5. **Larangan Mock Palsu**:
   - **DILARANG** membuat mock implementation, data statis `localStorage`, atau fungsi *stub* yang menyamar sebagai fitur produksi yang sudah selesai.
   - Jika suatu bagian terpaksa belum terhubung ke backend/provider karena ketergantungan eksternal yang belum siap, tandai secara eksplisit di kode (`TODO` / error state jujur) dan catat sebagai `IN PROGRESS` atau `BLOCKED` di `HANDOFF.md`.
6. **Disiplin Skema Zod & Konvensi Prop Komponen UI**:
   - Pada form `React Hook Form` yang menggunakan `zodResolver(schema)`, hindari penggunaan `.default(...)` di skema Zod objek karena memicu inkonsistensi tipe input vs output pada resolver TypeScript. Selalu berikan nilai default form secara eksplisit pada opsi `useForm({ defaultValues: ... })`.
   - Patuhi konvensi nama prop pada komponen UI yang sudah terpasang:
     - `Modal`: `open: boolean` (bukan `isOpen`), `onClose: () => void`.
     - `ConfirmDialog`: `open: boolean` (bukan `isOpen`), `confirmLabel` & `cancelLabel` (bukan `confirmText` / `cancelText`).
     - `ErrorState`: `message: string` (bukan `description`).
     - `EmptyState`: `actionLabel?: string` & `onAction?: () => void`.
     - `Badge`: `variant: 'default' | 'brand' | 'income' | 'expense' | 'warning'`.

---

## 4. Keamanan, Privasi, dan Integritas Data Finansial

1. **Kerahasiaan Secret & API Key**:
   - **JANGAN PERNAH** mengekspos secret key (`SUPABASE_SERVICE_ROLE_KEY`, `AI_PROVIDER_API_KEY`, kredensial database) di kode frontend, variabel `VITE_*`, bundle klien, log, atau dokumen repositori.
   - Hanya `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` yang diizinkan berada di sisi klien, dengan syarat seluruh tabel dilindungi oleh Row Level Security (RLS).
   - Seluruh pemanggilan ke AI gateway (9Router, OpenRouter, atau provider OpenAI-compatible lainnya) **WAJIB** melalui endpoint server-side / edge function.
2. **Autentikasi, RLS, dan Isolasi Data**:
   - Setiap tabel yang menyimpan data pengguna wajib memiliki kolom `user_id` yang merujuk ke `auth.users(id)`.
   - Setiap tabel wajib mengaktifkan Supabase **Row Level Security (RLS)** dengan policy ketat (`auth.uid() = user_id`) untuk `SELECT`, `INSERT`, `UPDATE`, dan `DELETE`.
   - Tidak boleh ada data lintas pengguna yang bocor melalui query klien maupun konteks prompt AI.
3. **Konsistensi Saldo & Invariant Finansial**:
   - Semua operasi finansial (pemasukan, pengeluaran, transfer antar-rekening, pembayaran utang/piutang, alokasi tabungan, edit/hapus transaksi) **wajib mempertahankan konsistensi saldo rekening/dompet**.
   - Operasi multi-langkah (mis. pembuatan transaksi + pembaruan saldo rekening, atau transfer yang mendebit rekening asal dan mengkredit rekening tujuan) **wajib bersifat atomik** (menggunakan transaksi database PostgreSQL / RPC function `SECURITY INVOKER`).
   - Gunakan representasi nilai uang integer Rupiah presisi (`BIGINT` di database, integer `number` di TypeScript) tanpa desimal/floating-point untuk mencegah *rounding error*, serta gunakan format tampilan `id-ID` (`formatIDR`).
4. **AI Transaction Drafting (Human-in-the-Loop Wajib)**:
   - AI Financial Assistant **DILARANG** menulis, mengubah, atau menghapus transaksi/data finansial secara langsung ke database tanpa konfirmasi eksplisit pengguna.
   - Alur AI transaction drafting hanya menghasilkan **draf terstruktur** yang harus ditinjau, dapat diedit, dan dikonfirmasi oleh pengguna sebelum dieksekusi melalui jalur validasi transaksi standar.
5. **Lingkungan Eksekusi Windows (npm.cmd Wajib)**:
   - Pada terminal Windows PowerShell, pemanggilan `npm` langsung dapat terblokir oleh ExecutionPolicy (`npm.ps1`). Setiap agent **WAJIB** memanggil `npm.cmd` (mis. `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test`) untuk memastikan eksekusi perintah berjalan lancar tanpa error permission script.

---

## 5. Kejujuran Pelaporan & Verifikasi Kualitas

1. **Dilarang Mengarang Status (Zero Hallucination on Status)**:
   - Jangan pernah mengklaim bahwa kode sudah di-test, build berhasil, database sudah dimigrasi, API eksternal tersedia, atau aplikasi sudah ter-deploy jika Anda belum menjalankannya dan memverifikasi output-nya secara nyata.
   - Bedakan secara tegas antara status:
     - `PLANNED` (baru dirancang di dokumen)
     - `IN PROGRESS` (sedang dikerjakan / belum lengkap)
     - `IMPLEMENTED` (kode sudah ditulis, belum diverifikasi penuh)
     - `TESTED` (sudah diverifikasi dengan test/typecheck/build)
     - `DEPLOYED` (sudah tayang dan diverifikasi di environment target)
     - `BLOCKED` (terhenti karena ketergantungan eksternal/keputusan pengguna)
2. **Verifikasi Wajib Sebelum Menyelesaikan Task**:
   - Apabila project sudah memiliki skrip proyek (`package.json`), jalankan perintah verifikasi yang tersedia sebelum mengakhiri task:
     - Typecheck (`tsc --noEmit` / `npm run typecheck`)
     - Linter (`npm run lint`)
     - Automated Tests (`npm run test`)
     - Production Build (`npm run build`)
   - Catat perintah yang benar-benar dijalankan beserta hasil keluarannya secara jujur di `HANDOFF.md`.

---

## 6. Protokol Pembaruan Dokumentasi & Handoff

1. **Wajib Update `HANDOFF.md`**: Setiap kali selesai mengerjakan sebuah task atau sebelum mengakhiri sesi, perbarui `HANDOFF.md` agar AI coding agent berikutnya mengetahui kondisi persis repositori tanpa harus menebak.
2. **Kapan Harus Memperbarui Dokumen Lain**:
   - Perbarui **`PRD.md`** hanya jika ada perubahan kebutuhan produk, aturan bisnis, atau scope fitur yang disetujui pengguna.
   - Perbarui **`ARCHITECTURE.md`** jika ada perubahan pada struktur folder, skema tabel/RLS, kontrak API server-side, atau keputusan teknis yang tadinya *pending* menjadi *confirmed*.
3. **Konsistensi Istilah**: Gunakan terminologi modul yang seragam di seluruh dokumen dan kode (lihat kamus istilah di `PRD.md` dan `ARCHITECTURE.md`).

---

## 7. Hierarki Resolusi Konflik

Jika Anda menemukan instruksi atau kondisi yang saling bertentangan antara prompt, kode, atau dokumen, gunakan urutan prioritas berikut (dari tertinggi ke terendah):

1. **Keamanan & Privasi Data** (Perlindungan secret, autentikasi, RLS, isolasi data pengguna).
2. **Integritas Data Finansial** (Konsistensi saldo, atomisitas transaksi, larangan AI menulis tanpa konfirmasi pengguna).
3. **Keputusan Eksplisit yang Terdokumentasi** (`AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, dan instruksi langsung pengguna).
4. **Kebutuhan Fungsional Produk & UX**.

> **Aturan Berhenti Aman (Safe Stop Rule)**: Apabila suatu konflik berpotensi menyebabkan perubahan destruktif, kehilangan data, atau pelanggaran arsitektur, **berhenti dan jelaskan konflik tersebut kepada pengguna** terlebih dahulu sebelum mengeksekusi perubahan.

