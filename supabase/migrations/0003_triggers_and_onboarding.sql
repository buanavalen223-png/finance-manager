-- ============================================================================
-- FINORA AI — MIGRATION 0003: TRIGGERS, OWNER ENFORCEMENT & ATOMIC BALANCES
-- ============================================================================
-- Prinsip Keamanan & Atomisitas:
-- 1. Jangan mengandalkan client untuk menentukan `user_id`:
--    Trigger `enforce_owner_user_id` menimpa `NEW.user_id := auth.uid()` saat
--    INSERT oleh sesi terautentikasi dan melarang perubahan `user_id` saat UPDATE.
-- 2. Konsistensi Saldo Atomik:
--    Trigger `sync_account_balance_on_transaction` menjaga `accounts.current_balance`
--    selalu sinkron setiap kali `transactions` ditambah, diubah, atau dihapus.
-- 3. Onboarding Pengguna Baru:
--    Trigger `on_auth_user_created` membuat baris `profiles`,
--    `notification_preferences`, dan kategori bawaan secara otomatis.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNGSI & TRIGGER: Auto-update kolom `updated_at`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. FUNGSI & TRIGGER: Server-Side `user_id` Ownership Enforcement
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_owner_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Jika dipanggil oleh sesi pengguna terautentikasi, paksa user_id = auth.uid()
    IF auth.uid() IS NOT NULL THEN
      NEW.user_id := auth.uid();
    END IF;
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION 'user_id wajib terisi dari sesi autentikasi yang valid.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Dilarang keras memindahkan kepemilikan record ke user_id lain
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Perubahan kepemilikan user_id tidak diizinkan.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Pasang trigger `updated_at` dan `enforce_owner_user_id` secara idempoten
DO $$
DECLARE
  t TEXT;
  user_tables TEXT[] := ARRAY[
    'profiles',
    'accounts',
    'categories',
    'transactions',
    'budgets',
    'savings_goals',
    'debts',
    'debt_payments',
    'recurring_transactions',
    'notification_preferences'
  ];
BEGIN
  FOREACH t IN ARRAY user_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );

    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_enforce_owner ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_enforce_owner BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_user_id();',
      t, t
    );
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. FUNGSI & TRIGGER: Inisialisasi Saldo Awal Rekening (`accounts`)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.initialize_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.current_balance = 0 AND NEW.initial_balance <> 0 THEN
    NEW.current_balance := NEW.initial_balance;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_init_balance ON public.accounts;
CREATE TRIGGER trg_accounts_init_balance
  BEFORE INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_account_balance();

-- ----------------------------------------------------------------------------
-- 4. FUNGSI & TRIGGER: Mutasi Saldo Rekening Atomik pada `transactions`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_account_balance_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- A. Batalkan efek transaksi lama jika UPDATE atau DELETE
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.type = 'income' THEN
      UPDATE public.accounts
      SET current_balance = current_balance - OLD.amount
      WHERE id = OLD.account_id AND user_id = OLD.user_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE public.accounts
      SET current_balance = current_balance + OLD.amount
      WHERE id = OLD.account_id AND user_id = OLD.user_id;
    ELSIF OLD.type = 'transfer' THEN
      UPDATE public.accounts
      SET current_balance = current_balance + OLD.amount
      WHERE id = OLD.account_id AND user_id = OLD.user_id;

      UPDATE public.accounts
      SET current_balance = current_balance - OLD.amount
      WHERE id = OLD.destination_account_id AND user_id = OLD.user_id;
    END IF;
  END IF;

  -- B. Terapkan efek transaksi baru jika INSERT atau UPDATE
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.type = 'income' THEN
      UPDATE public.accounts
      SET current_balance = current_balance + NEW.amount
      WHERE id = NEW.account_id AND user_id = NEW.user_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE public.accounts
      SET current_balance = current_balance - NEW.amount
      WHERE id = NEW.account_id AND user_id = NEW.user_id;
    ELSIF NEW.type = 'transfer' THEN
      UPDATE public.accounts
      SET current_balance = current_balance - NEW.amount
      WHERE id = NEW.account_id AND user_id = NEW.user_id;

      UPDATE public.accounts
      SET current_balance = current_balance + NEW.amount
      WHERE id = NEW.destination_account_id AND user_id = NEW.user_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_sync_balance ON public.transactions;
CREATE TRIGGER trg_transactions_sync_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_account_balance_on_transaction();

-- ----------------------------------------------------------------------------
-- 5. FUNGSI & TRIGGER: Onboarding Otomatis Saat Registrasi (`auth.users`)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(COALESCE(NEW.email, 'Pengguna Finora'), '@', 1)
  );

  -- 1. Buat baris profil
  INSERT INTO public.profiles (id, user_id, full_name, currency_code, theme_preference)
  VALUES (NEW.id, NEW.id, v_full_name, 'IDR', 'system')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Buat baris preferensi notifikasi
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Buat kategori bawaan jika pengguna belum memiliki kategori
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = NEW.id) THEN
    INSERT INTO public.categories (user_id, name, type, color, icon, is_system)
    VALUES
      (NEW.id, 'Gaji & Penghasilan Utama', 'income', '#176B52', 'briefcase', true),
      (NEW.id, 'Bonus & Proyek Freelance', 'income', '#2B8A6E', 'sparkles', true),
      (NEW.id, 'Makanan & Minuman', 'expense', '#176B52', 'utensils', true),
      (NEW.id, 'Transportasi', 'expense', '#4E7D6E', 'car', true),
      (NEW.id, 'Hunian & Tagihan Utilitas', 'expense', '#2E5A4C', 'home', true),
      (NEW.id, 'Belanja Kebutuhan Rumah', 'expense', '#789E90', 'shopping-bag', true),
      (NEW.id, 'Kesehatan & Olahraga', 'expense', '#A3BFB5', 'heart-pulse', true),
      (NEW.id, 'Pendidikan & Pengembangan', 'expense', '#3B6E5C', 'book-open', true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_onboarding();

