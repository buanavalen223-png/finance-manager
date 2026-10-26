-- ============================================================================
-- FINORA AI — MIGRATION 0001: INITIAL RELATIONAL SCHEMA (IDEMPOTENT / SAFE)
-- ============================================================================
-- Prinsip Keamanan & Integritas:
-- 1. Dapat dijalankan berulang kali dengan aman (CREATE TABLE IF NOT EXISTS,
--    CREATE INDEX IF NOT EXISTS) tanpa menghapus atau mereset data produksi.
-- 2. Seluruh nilai uang menggunakan BIGINT (integer Rupiah, satuan Rp 1).
-- 3. Setiap tabel data pengguna memiliki kolom `user_id` DEFAULT auth.uid()
--    yang merujuk ke `auth.users(id) ON DELETE CASCADE`.
-- 4. Menggunakan Composite Unique Key `(id, user_id)` dan Composite Foreign Key
--    lintas tabel untuk menjamin pengguna TIDAK DAPAT mereferensikan `account_id`,
--    `category_id`, atau `debt_id` milik pengguna lain di level mesin database.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABEL PROFILES (1:1 dengan auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  currency_code TEXT NOT NULL DEFAULT 'IDR' CHECK (currency_code = 'IDR'),
  theme_preference TEXT NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
  locale TEXT NOT NULL DEFAULT 'id-ID',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profiles_id_matches_user_id CHECK (id = user_id)
);

-- ----------------------------------------------------------------------------
-- 2. TABEL ACCOUNTS (Rekening Bank / E-Wallet / Kas Tunai)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'ewallet', 'investment', 'other')),
  currency_code TEXT NOT NULL DEFAULT 'IDR' CHECK (currency_code = 'IDR'),
  initial_balance BIGINT NOT NULL DEFAULT 0,
  current_balance BIGINT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#176B52',
  icon TEXT NOT NULL DEFAULT 'wallet',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT accounts_id_user_id_unique UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_active ON public.accounts(user_id, is_archived);

-- ----------------------------------------------------------------------------
-- 3. TABEL CATEGORIES (Kategori Pemasukan & Pengeluaran)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT NOT NULL DEFAULT '#176B52',
  icon TEXT NOT NULL DEFAULT 'tag',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT categories_id_user_id_unique UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id, type, is_archived);

-- ----------------------------------------------------------------------------
-- 4. TABEL TRANSACTIONS (Pemasukan, Pengeluaran, dan Transfer)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  destination_account_id UUID,
  category_id UUID,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 250),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (
    source IN (
      'manual',
      'ai_draft',
      'recurring',
      'debt_payment',
      'savings_contribution',
      'balance_adjustment'
    )
  ),
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT transactions_id_user_id_unique UNIQUE (id, user_id),
  CONSTRAINT transactions_account_owner_fk
    FOREIGN KEY (account_id, user_id)
    REFERENCES public.accounts(id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT transactions_destination_account_owner_fk
    FOREIGN KEY (destination_account_id, user_id)
    REFERENCES public.accounts(id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT transactions_category_owner_fk
    FOREIGN KEY (category_id, user_id)
    REFERENCES public.categories(id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT transactions_transfer_invariant CHECK (
    (
      type = 'transfer'
      AND destination_account_id IS NOT NULL
      AND destination_account_id <> account_id
      AND category_id IS NULL
    )
    OR (
      type IN ('income', 'expense')
      AND destination_account_id IS NULL
      AND category_id IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions(user_id, transaction_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_account
  ON public.transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category
  ON public.transactions(user_id, category_id);

-- ----------------------------------------------------------------------------
-- 5. TABEL BUDGETS (Anggaran Pengeluaran Bulanan per Kategori)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  amount_limit BIGINT NOT NULL CHECK (amount_limit > 0),
  alert_threshold_percent INTEGER NOT NULL DEFAULT 80 CHECK (alert_threshold_percent BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT budgets_user_category_period_unique
    UNIQUE (user_id, category_id, period_year, period_month),
  CONSTRAINT budgets_category_owner_fk
    FOREIGN KEY (category_id, user_id)
    REFERENCES public.categories(id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_period
  ON public.budgets(user_id, period_year, period_month);

-- ----------------------------------------------------------------------------
-- 6. TABEL SAVINGS_GOALS (Target Tabungan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  target_amount BIGINT NOT NULL CHECK (target_amount > 0),
  current_amount BIGINT NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT savings_goals_account_owner_fk
    FOREIGN KEY (account_id, user_id)
    REFERENCES public.accounts(id, user_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_status
  ON public.savings_goals(user_id, status);

-- ----------------------------------------------------------------------------
-- 7. TABEL DEBTS (Catatan Utang & Piutang)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
  counterparty_name TEXT NOT NULL CHECK (char_length(btrim(counterparty_name)) BETWEEN 1 AND 100),
  principal_amount BIGINT NOT NULL CHECK (principal_amount > 0),
  remaining_amount BIGINT NOT NULL CHECK (remaining_amount >= 0 AND remaining_amount <= principal_amount),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT debts_id_user_id_unique UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_debts_user_status
  ON public.debts(user_id, status, due_date);

-- ----------------------------------------------------------------------------
-- 8. TABEL DEBT_PAYMENTS (Riwayat Pembayaran / Cicilan Utang & Piutang)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL,
  transaction_id UUID,
  amount BIGINT NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 250),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT debt_payments_debt_owner_fk
    FOREIGN KEY (debt_id, user_id)
    REFERENCES public.debts(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT debt_payments_tx_owner_fk
    FOREIGN KEY (transaction_id, user_id)
    REFERENCES public.transactions(id, user_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_user_debt
  ON public.debt_payments(user_id, debt_id, payment_date DESC);

-- ----------------------------------------------------------------------------
-- 9. TABEL RECURRING_TRANSACTIONS (Tagihan & Transaksi Berulang)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID,
  category_id UUID,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  next_due_date DATE NOT NULL,
  last_executed_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT recurring_tx_account_owner_fk
    FOREIGN KEY (account_id, user_id)
    REFERENCES public.accounts(id, user_id)
    ON DELETE SET NULL,
  CONSTRAINT recurring_tx_category_owner_fk
    FOREIGN KEY (category_id, user_id)
    REFERENCES public.categories(id, user_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recurring_tx_user_due
  ON public.recurring_transactions(user_id, is_active, next_due_date);

-- ----------------------------------------------------------------------------
-- 10. TABEL NOTIFICATION_PREFERENCES (Preferensi Pengingat Pengguna)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_alert_enabled BOOLEAN NOT NULL DEFAULT true,
  recurring_reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  debt_reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_summary_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_days_before INTEGER NOT NULL DEFAULT 3 CHECK (reminder_days_before BETWEEN 0 AND 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id
  ON public.notification_preferences(user_id);

