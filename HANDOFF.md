# HANDOFF.md — Finora AI Cross-Agent State & Handoff Log

> **INSTRUKSI UNTUK AI CODING AGENT**:
> File ini adalah sumber kebenaran kondisi aktual repositori saat ini. Perbarui file ini setiap kali Anda menyelesaikan task atau mengakhiri sesi kerja. Gunakan hanya status: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, atau `DONE`. Jangan pernah mengklaim pengujian, build, atau fitur sebagai `DONE` tanpa bukti eksekusi nyata.

---

## 1. Current Project Status

- **Overall Project Phase**: Milestone 4 Completed — Financial Planning Modules (Budgets, Savings Goals, Debts & Recurring Bills) Verified (`TESTED`)
- **Application Code Status**: `DONE` untuk cakupan **Milestone 1, Milestone 2, Milestone 3, dan Milestone 4** (Design System Fintech, Autentikasi & RLS Supabase, Dashboard Produksi Supabase dengan Ringkasan Anggaran & Tagihan Jatuh Tempo, Modul Rekening/Dompet, Modul Kategori, Modul Transaksi Konsistensi Atomik, Modul Anggaran Bulanan & Keseluruhan, Modul Target Tabungan & Alokasi/Penarikan Dana, Modul Utang & Piutang dengan Cicilan/Pelunasan, Modul Tagihan & Transaksi Berulang Idempoten, serta Suite Pengujian 32/32 tests lulus).
- **Repository Git Status**: Belum diinisialisasi (`not a git repository`).
- **Last Updated**: 2026-10-26

---

## 2. Milestone Tracking

- **Current Active / Next Milestone**: **Milestone 5 — Dashboard Analytics, Reports & CSV Export** (`NOT STARTED`)
- **Last Completed Milestone**: **Milestone 4 — Financial Planning: Budgets, Savings Goals, Debts & Recurring Bills** (`DONE`)

### Milestone Overview Table

| Milestone | Nama Milestone | Status | Catatan |
| :--- | :--- | :--- | :--- |
| **M0** | Project Governance & Architecture Baseline | `DONE` | `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, dan `HANDOFF.md` telah diselaraskan. |
| **M1** | Design System, Layout Shell & UI Dashboard | `DONE` | Design system, komponen umum, dan Dashboard dengan fixture demo terisolasi selesai. |
| **M2** | Backend, Database, Authentication & Data Isolation | `DONE` | Migrasi SQL 10 tabel (`0001`–`0003`), RLS ketat, Auth UI, ProtectedRoute, CRUD Profil & Notifikasi selesai. |
| **M3** | Core Ledger — Accounts/Wallets, Categories & Atomic Transactions | `DONE` | Satu sumber kebenaran kalkulasi buku besar (`ledger.ts`), migrasi `0004`, CRUD Rekening, Kategori, Transaksi, dan Dashboard Produksi selesai. |
| **M4** | Financial Planning — Budgets, Savings Goals, Debts & Recurring | `DONE` | Anggaran bulanan/keseluruhan (`budgets`), Target Tabungan & Kontribusi (`savings_goals`/`savings_contributions`), Utang/Piutang & Cicilan (`debts`/`debt_payments`), Transaksi Berulang (`recurring_transactions`), dan widget Tagihan Terdekat (`UpcomingBillsCard`). Lulus 32/32 tests. |
| **M5** | Dashboard Analytics, Reports & CSV Export | `NOT STARTED` | Halaman Laporan analitik periodik dengan visualisasi Recharts dan ekspor CSV aman anti-formula injection. |
| **M6** | Server-Side AI Provider Abstraction, AI Assistant & Transaction Drafting | `NOT STARTED` | Endpoint `/api/ai/*`, AI Financial Assistant, dan AI Transaction Drafting dengan konfirmasi pengguna (Human-in-the-Loop). |
| **M7** | End-to-End Verification, Hardening & Deployment Readiness | `NOT STARTED` | Verifikasi menyeluruh, audit aksesibilitas, responsivitas mobile/desktop, dan kesiapan deployment Vercel. |

---

## 3. Task Breakdown

### 3.1 Completed Tasks (`DONE`)
- `[DONE]` **M0**: Penyusunan dokumen tata kelola acuan (`AGENTS.md`, `PRD.md`, `ARCHITECTURE.md`, `HANDOFF.md`).
- `[DONE]` **M1**: Design System Minimalist Premium Fintech, Layout Responsif, Komponen Reusable, dan UI Dashboard.
- `[DONE]` **M2.1 – M2.2**: Migrasi SQL 10 tabel + RLS + Trigger Atomik (`0001`–`0003`), Supabase Auth Flow, Protected Routes, CRUD Profil & Preferensi Notifikasi.
- `[DONE]` **M3.1 – M3.2**: Mesin buku besar tunggal (`ledger.ts`), migrasi `0004`, CRUD Rekening, Kategori, Transaksi, serta penegakan konsistensi saldo atomik integer Rupiah.
- `[DONE]` **M4.1 (Anggaran Bulanan & Target Tabungan)**:
  - `supabase/migrations/0005_planning_enhancements.sql`: `budgets.category_id` dibuat `NULLABLE` untuk mendukung anggaran keseluruhan (`WHERE category_id IS NULL` dengan partial unique index); tabel `savings_contributions` dengan RLS dan trigger atomik `sync_savings_goal_on_contribution` untuk mutasi saldo tabungan.
  - `src/lib/finance/planning.ts`: Fungsi `calculateBudgetRealization` (secara ketat mengecualikan transfer dan income dari beban anggaran, menghitung status `safe`/`warning`/`over`) dan `simulateSavingsPlan` (menghitung sisa hari, estimasi kebutuhan per minggu/bulan, serta penanganan target tercapai).
  - `src/services/budget.service.ts` & `src/services/savings.service.ts`: CRUD penuh Supabase dengan validasi kepemilikan dan sanitasi `user_id`.
  - `src/pages/BudgetsPage.tsx`: Halaman interaktif anggaran bulanan (navigasi periode bulan/tahun, pagu per kategori dan keseluruhan, progress bar, alert ambang batas, modal tambah/edit/hapus).
  - `src/pages/SavingsGoalsPage.tsx`: Halaman target tabungan (visualisasi progres capaian, modal alokasi deposit/penarikan dana terhubung ke dompet, riwayat kontribusi, dan simulasi tabungan per minggu/bulan).
- `[DONE]` **M4.2 (Utang/Piutang & Transaksi Berulang)**:
  - `supabase/migrations/0005_planning_enhancements.sql`: Trigger `sync_debt_on_payment_change` yang secara otomatis memperbarui `remaining_amount` dan status utang (`unpaid`, `partial`, `paid`).
  - `src/lib/finance/planning.ts`: Fungsi `resolveDebtStatus` (`unpaid`, `partial`, `paid`, `overdue`), `computeNextDueDate` (pemajuan siklus `daily`, `weekly`, `monthly`, `yearly` dengan penanganan overflow akhir bulan), `classifyDueStatus` (`overdue`, `due_today`, `upcoming`, `scheduled`), dan `getUpcomingBills`.
  - `src/services/debt.service.ts` & `src/services/recurring.service.ts`: CRUD utang/piutang beserta pelunasan cicilan parsial/penuh (opsional dicatat ke transaksi dompet) serta eksekusi transaksi berulang idempoten (`executeRecurringTransaction`).
  - `src/pages/DebtsPage.tsx`: Halaman utang & piutang (tab filter jenis, filter status, pencarian pihak terkait, kartu sisa kewajiban, modal catat pembayaran dengan validasi anti-overpay, riwayat pembayaran, dan hapus konfirmasi).
  - `src/pages/RecurringBillsPage.tsx`: Halaman tagihan rutin & transaksi berulang (kartu estimasi beban bulanan, status jatuh tempo, tombol eksekusi "Catat Sekarang" idempoten, toggle aktif/nonaktif, modal buat/edit jadwal).
- `[DONE]` **M4.3 (Integrasi Dashboard Produksi & Routing)**:
  - `src/components/features/dashboard/UpcomingBillsCard.tsx`: Komponen widget dashboard menampilkan tagihan dan kewajiban utang 7 hari ke depan dengan status terverifikasi.
  - `src/components/features/dashboard/BudgetSummaryCard.tsx`: Diperbarui untuk mendukung domain `Budget` dan anggaran keseluruhan (`categoryId: null`).
  - `src/pages/DashboardPage.tsx`: Terhubung ke data nyata Supabase untuk `budgets`, `recurring_transactions`, dan `debts`.
  - `src/App.tsx` & `src/pages/ModulePages.tsx`: Rute privat `/anggaran`, `/tabungan`, `/utang-piutang`, dan `/tagihan-berulang` kini mengarah ke halaman produksi penuh.
- `[DONE]` **M4.4 (Suite Pengujian Perencanaan Keuangan)**:
  - `tests/planning-and-finance.test.ts`: 16 test komprehensif menguji realisasi anggaran tanpa pencemaran transfer, simulasi tabungan, status pelunasan dan keterlambatan utang, pemajuan siklus berulang, agregasi tagihan terdekat, dan validasi Zod.

### 3.2 In-Progress Tasks (`IN PROGRESS`)
- Tidak ada task yang sedang berjalan (`None`). Milestone 4 telah selesai sepenuhnya dan diverifikasi.

### 3.3 Pending Tasks (`NOT STARTED`)
1. `[NOT STARTED]` **M5.1**: Halaman Laporan Keuangan periodik (`ReportsPage`) dengan grafik Recharts (arus kas bulanan, breakdown pengeluaran kategori) dan ekspor CSV aman (`src/lib/csv.ts`).
2. `[NOT STARTED]` **M6.1 – M6.2**: Abstraksi AI provider server-side (`/api/ai/*`), AI Assistant kontekstual, dan AI Transaction Drafting dengan alur Human-in-the-Loop.
3. `[NOT STARTED]` **M7.1**: Verifikasi akhir end-to-end, audit keamanan/aksesibilitas, dan kesiapan deployment Vercel.

---

## 4. Files Changed / Created in Milestone 4

| File Path | Action | Status | Deskripsi |
| :--- | :--- | :--- | :--- |
| `supabase/migrations/0005_planning_enhancements.sql` | Created | `DONE` | Migrasi DDL: `budgets.category_id` nullable, tabel `savings_contributions`, trigger `sync_savings_goal_on_contribution`, trigger `sync_debt_on_payment_change`. |
| `src/types/database.types.ts` | Updated | `DONE` | Penambahan tipe baris database `SavingsContributionRow` dan pembaruan `BudgetRow` (`category_id: string | null`). |
| `src/types/domain.ts` | Updated | `DONE` | Definisi domain `SavingsContribution`, `Budget`, `DebtRecord`, `RecurringTransaction` dengan timestamp ISO. |
| `src/schemas/planning.schema.ts` | Created | `DONE` | Skema validasi Zod form anggaran, target tabungan, kontribusi, utang, pembayaran, dan transaksi berulang. |
| `src/lib/finance/planning.ts` | Created | `DONE` | Mesin pure-functions perencanaan keuangan: realisasi anggaran (eksklusi transfer), simulasi tabungan, status utang, siklus transaksi berulang, dan tagihan terdekat. |
| `src/services/budget.service.ts` | Created | `DONE` | CRUD Anggaran bulanan dan keseluruhan ke Supabase. |
| `src/services/savings.service.ts` | Created | `DONE` | CRUD Target tabungan & pencatatan mutasi kontribusi (deposit/penarikan). |
| `src/services/debt.service.ts` | Created | `DONE` | CRUD Utang/Piutang & pencatatan pembayaran cicilan dengan integrasi rekening opsional. |
| `src/services/recurring.service.ts` | Created | `DONE` | CRUD Transaksi Berulang, toggle aktif/nonaktif, dan eksekusi pencatatan riil idempoten ke buku besar. |
| `src/pages/BudgetsPage.tsx` | Created | `DONE` | UI Halaman Anggaran Bulanan (pagu per kategori & keseluruhan, progress bar, navigasi periode, modal CRUD). |
| `src/pages/SavingsGoalsPage.tsx` | Created | `DONE` | UI Halaman Target Tabungan (progres visual, modal alokasi deposit/tarik dana, riwayat mutasi, simulasi mingguan/bulanan). |
| `src/pages/DebtsPage.tsx` | Created | `DONE` | UI Halaman Utang & Piutang (filter tab, ringkasan sisa kewajiban, modal bayar cicilan dengan anti-overpay, riwayat pembayaran). |
| `src/pages/RecurringBillsPage.tsx` | Created | `DONE` | UI Halaman Tagihan Berulang (estimasi beban bulanan, status jatuh tempo, eksekusi satu klik "Catat Sekarang"). |
| `src/components/features/dashboard/UpcomingBillsCard.tsx` | Created | `DONE` | Widget Dashboard pengingat tagihan dan utang yang jatuh tempo 7 hari ke depan. |
| `src/components/features/dashboard/BudgetSummaryCard.tsx` | Updated | `DONE` | Menangani anggaran keseluruhan (`categoryId: null`) dan kategori pengeluaran secara terpadu. |
| `src/pages/DashboardPage.tsx` | Updated | `DONE` | Terhubung ke data anggaran riil dan menampilkan widget `UpcomingBillsCard`. |
| `src/App.tsx` & `src/pages/ModulePages.tsx` | Updated | `DONE` | Rute privat 4 modul M4 diarahkan ke halaman produksi dan placeholder dibersihkan. |
| `tests/planning-and-finance.test.ts` | Created | `DONE` | 16 unit & integration tests untuk logika bisnis perencanaan keuangan dan validasi skema. |

---

## 5. Database / Schema Changes

Lima file migrasi SQL idempoten telah tersedia di `supabase/migrations/`:
1. **`0001_initial_schema.sql`**: 10 tabel inti dengan `BIGINT` IDR, constraint `amount > 0`, `transactions_transfer_invariant` (`destination_account_id <> account_id`), dan composite FK `(id, user_id)`.
2. **`0002_rls_policies.sql`**: `ENABLE` & `FORCE ROW LEVEL SECURITY` dengan 40 policy `auth.uid() = user_id`.
3. **`0003_triggers_and_onboarding.sql`**: Trigger `enforce_owner_user_id`, trigger mutasi saldo atomik `sync_account_balance_on_transaction`, dan onboarding kategori default.
4. **`0004_ledger_atomic_rpcs.sql`**: Trigger `sync_account_on_initial_balance_update` dan fungsi RPC `recalculate_account_balance(UUID)`.
5. **`0005_planning_enhancements.sql`**:
   - `budgets.category_id` diubah menjadi `NULLABLE` + partial unique index `idx_budgets_user_overall_unique` untuk anggaran bulanan keseluruhan.
   - Tabel `savings_contributions` (`id`, `user_id`, `savings_goal_id`, `amount`, `type`, `account_id`, `transaction_id`, `contribution_date`, `notes`) dengan RLS ketat dan trigger atomik `sync_savings_goal_on_contribution`.
   - Trigger `sync_debt_on_payment_change` pada `debt_payments` untuk menghitung sisa kewajiban `debts.remaining_amount` dan status (`paid`/`partial`/`unpaid`) secara atomik.

---

## 6. Environment / Configuration Requirements (Tanpa Nilai Secret)

Lihat `.env.example`:
- **Browser / Client (Wajib dengan RLS Aktif)**:
  - `VITE_APP_NAME="Finora AI"`
  - `VITE_SUPABASE_URL="https://<project-ref>.supabase.co"`
  - `VITE_SUPABASE_ANON_KEY="<public-anon-key>"`
- **Server-Side Only (Dilarang menggunakan prefix `VITE_`)**:
  - `AI_PROVIDER_NAME`, `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_API_KEY`, `AI_MODEL_NAME`, `AI_REQUEST_TIMEOUT_MS`.

---

## 7. Tests Actually Executed and Their Results

1. **`npm.cmd run typecheck`** (`tsc --noEmit`) $\rightarrow$ **PASS** (Exit code 0, 0 errors).
2. **`npm.cmd run lint`** (`eslint .`) $\rightarrow$ **PASS** (Exit code 0, 0 errors, 0 warnings).
3. **`npm.cmd run test`** (`vitest run`) $\rightarrow$ **PASS** (Exit code 0, 4 test files passed, **32/32 tests passed**):
   - `tests/currency.test.ts` (6/6 tests passed)
   - `tests/auth-and-isolation.test.ts` (5/5 tests passed)
   - `tests/ledger-and-transactions.test.ts` (5/5 tests passed)
   - `tests/planning-and-finance.test.ts` (16/16 tests passed)
4. **`npm.cmd run build`** (`tsc -b && vite build`) $\rightarrow$ **PASS** (Exit code 0, waktu build 12.76s):
   - `dist/index.html` (1.37 kB │ gzip: 0.60 kB)
   - `dist/assets/index-*.css` (30.39 kB │ gzip: 6.19 kB)
   - `dist/assets/vendor-icons-*.js` (28.16 kB │ gzip: 5.98 kB)
   - `dist/assets/vendor-react-*.js` (52.24 kB │ gzip: 18.41 kB)
   - `dist/assets/vendor-forms-*.js` (89.12 kB │ gzip: 24.97 kB)
   - `dist/assets/vendor-supabase-*.js` (227.08 kB │ gzip: 58.97 kB)
   - `dist/assets/vendor-charts-*.js` (410.94 kB │ gzip: 111.49 kB)
   - `dist/assets/index-*.js` (511.20 kB │ gzip: 132.71 kB)

---

## 8. Known Bugs and Limitations

- Sisa modul yang belum diimplementasikan adalah **Milestone 5** (`ReportsPage` dan ekspor CSV) serta **Milestone 6** (Asisten Keuangan AI & Draf Transaksi). Rute keduanya saat ini menampilkan view fondasi terstruktur yang rapi.
- Ekspor CSV pada Milestone 5 wajib menerapkan sanitasi formula injection (karakter awalan `=`, `+`, `-`, `@` harus di-escape) sesuai ketentuan arsitektur keamanan.

---

## 9. Last Verified Build Status

- **Build Status**: `PASS` (`tsc -b && vite build` berhasil dengan `exit code 0` pada 2026-10-26).

---

## 10. Next Exact Task

**Task Berikutnya**: **Milestone 5: Dashboard Analytics, Financial Reports & CSV Export**
1. Implementasi modul ekspor CSV di `src/lib/csv.ts` dengan sanitasi anti-formula injection dan format mata uang Rupiah integer yang rapi.
2. Implementasi halaman Laporan Keuangan `src/pages/ReportsPage.tsx` dengan filter periode (bulan, tahun, rentang tanggal kustom), perbandingan pemasukan vs pengeluaran, visualisasi tren arus kas Recharts, rincian pengeluaran per kategori, dan tombol unduh CSV.
3. Hubungkan rute `/laporan` di `src/App.tsx` ke halaman laporan produksi.
4. Buat suite pengujian `tests/reports-and-export.test.ts` untuk memverifikasi akurasi kalkulasi periodik dan sanitasi formula CSV.

---

## 11. Definition of Done (DoD) untuk Task Berikutnya (Milestone 5)

- [ ] Modul `src/lib/csv.ts` dengan sanitasi formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`) dan format CSV UTF-8 BOM untuk Excel.
- [ ] Halaman `src/pages/ReportsPage.tsx` yang responsif, visualisasi Recharts, filter rentang tanggal dinamis, dan agregasi data transaksi riil.
- [ ] Tombol unduh laporan transaksi terfilter ke CSV berfungsi lancar di browser.
- [ ] Suite pengujian `tests/reports-and-export.test.ts` lulus 100%.
- [ ] Verifikasi `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, dan `npm.cmd run build` lulus tanpa error.
