-- ============================================================================
-- FINORA AI — MIGRATION 0004: ATOMIC LEDGER RPCs & BALANCE RECALCULATION
-- ============================================================================
-- Prinsip Keamanan & Integritas Buku Besar (Milestone 3):
-- 1. Satu Sumber Kebenaran (Single Source of Truth):
--    `accounts.current_balance` tidak pernah dihitung atau ditimpa langsung dari
--    angka total client. Saldo rekening secara matematis dan atomik mengikuti:
--      current_balance = initial_balance + SUM(income) - SUM(expense)
--                        - SUM(transfer_out) + SUM(transfer_in)
-- 2. Saat `accounts.initial_balance` diubah pada rekening yang sudah memiliki
--    riwayat transaksi, `current_balance` disesuaikan secara proporsional oleh
--    trigger `sync_account_on_initial_balance_update`.
-- 3. Menyediakan fungsi RPC (`SECURITY INVOKER`) untuk operasi transaksi
--    multi-record dan rekonsiliasi saldo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER: Sinkronisasi `current_balance` saat `initial_balance` diubah
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_account_on_initial_balance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.initial_balance IS DISTINCT FROM OLD.initial_balance THEN
    -- Abaikan input current_balance dari client dan sesuaikan sebesar delta initial_balance
    NEW.current_balance := OLD.current_balance + (NEW.initial_balance - OLD.initial_balance);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_sync_initial_balance ON public.accounts;
CREATE TRIGGER trg_accounts_sync_initial_balance
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_account_on_initial_balance_update();

-- ----------------------------------------------------------------------------
-- 2. FUNGSI RPC: Rekonsiliasi & Hitung Ulang Saldo Rekening dari Buku Besar
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_account_balance(p_account_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_initial_balance BIGINT;
  v_total_income BIGINT;
  v_total_expense BIGINT;
  v_total_transfer_out BIGINT;
  v_total_transfer_in BIGINT;
  v_computed_balance BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sesi pengguna tidak terautentikasi.';
  END IF;

  SELECT initial_balance
  INTO v_initial_balance
  FROM public.accounts
  WHERE id = p_account_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rekening tidak ditemukan atau bukan milik pengguna.';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' AND account_id = p_account_id THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' AND account_id = p_account_id THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'transfer' AND account_id = p_account_id THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'transfer' AND destination_account_id = p_account_id THEN amount ELSE 0 END), 0)
  INTO
    v_total_income,
    v_total_expense,
    v_total_transfer_out,
    v_total_transfer_in
  FROM public.transactions
  WHERE user_id = v_user_id
    AND (account_id = p_account_id OR destination_account_id = p_account_id);

  v_computed_balance := v_initial_balance + v_total_income - v_total_expense - v_total_transfer_out + v_total_transfer_in;

  UPDATE public.accounts
  SET current_balance = v_computed_balance
  WHERE id = p_account_id AND user_id = v_user_id;

  RETURN v_computed_balance;
END;
$$;

