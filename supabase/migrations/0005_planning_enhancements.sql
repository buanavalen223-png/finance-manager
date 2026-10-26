-- ============================================================================
-- FINORA AI — MIGRATION 0005: FINANCIAL PLANNING ENHANCEMENTS & ATOMIC SYNC
-- ============================================================================
-- Prinsip Keamanan & Integritas Perencanaan Keuangan (Milestone 4):
-- 1. Anggaran Keseluruhan & Kategori:
--    Kolom `category_id` pada `public.budgets` diubah menjadi NULLABLE sehingga
--    pengguna dapat menetapkan Anggaran Keseluruhan bulanan (category_id IS NULL)
--    maupun anggaran spesifik per kategori.
-- 2. Audit Trail Target Tabungan (`savings_contributions`):
--    Pencatatan alokasi dana masuk (deposit) atau penarikan (withdraw) dengan
--    trigger database yang menjaga `savings_goals.current_amount` tetap konsisten.
-- 3. Integritas Pembayaran Utang/Piutang:
--    Trigger `sync_debt_on_payment_change` menghitung ulang `remaining_amount`
--    dan `status` ('unpaid' | 'partial' | 'paid') secara atomik dari tabel
--    `debt_payments` untuk mencegah double counting atau inkonsistensi saldo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RELAKSASI CONSTRAINT: Anggaran Keseluruhan (`budgets.category_id` NULLABLE)
-- ----------------------------------------------------------------------------
ALTER TABLE public.budgets ALTER COLUMN category_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_overall_unique
  ON public.budgets(user_id, period_year, period_month)
  WHERE category_id IS NULL;

-- ----------------------------------------------------------------------------
-- 2. TABEL SAVINGS_CONTRIBUTIONS (Riwayat Alokasi Dana Target Tabungan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.savings_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL,
  account_id UUID,
  amount BIGINT NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL DEFAULT 'deposit' CHECK (type IN ('deposit', 'withdraw')),
  contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 250),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT savings_contrib_goal_owner_fk
    FOREIGN KEY (goal_id, user_id)
    REFERENCES public.savings_goals(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT savings_contrib_account_owner_fk
    FOREIGN KEY (account_id, user_id)
    REFERENCES public.accounts(id, user_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_savings_contrib_user_goal
  ON public.savings_contributions(user_id, goal_id, contribution_date DESC);

-- RLS untuk public.savings_contributions
ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_contributions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "savings_contrib_select_own" ON public.savings_contributions;
CREATE POLICY "savings_contrib_select_own" ON public.savings_contributions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "savings_contrib_insert_own" ON public.savings_contributions;
CREATE POLICY "savings_contrib_insert_own" ON public.savings_contributions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "savings_contrib_update_own" ON public.savings_contributions;
CREATE POLICY "savings_contrib_update_own" ON public.savings_contributions
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "savings_contrib_delete_own" ON public.savings_contributions;
CREATE POLICY "savings_contrib_delete_own" ON public.savings_contributions
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Trigger updated_at & enforce_owner_user_id untuk savings_contributions
DROP TRIGGER IF EXISTS trg_savings_contributions_updated_at ON public.savings_contributions;
CREATE TRIGGER trg_savings_contributions_updated_at
  BEFORE UPDATE ON public.savings_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_savings_contributions_enforce_owner ON public.savings_contributions;
CREATE TRIGGER trg_savings_contributions_enforce_owner
  BEFORE INSERT OR UPDATE ON public.savings_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_owner_user_id();

-- ----------------------------------------------------------------------------
-- 3. TRIGGER: Sinkronisasi Otomatis `savings_goals.current_amount` & `status`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_savings_goal_on_contribution()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_goal_id UUID;
  v_user_id UUID;
  v_total_deposits BIGINT;
  v_total_withdraws BIGINT;
  v_computed_amount BIGINT;
  v_target_amount BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_goal_id := OLD.goal_id;
    v_user_id := OLD.user_id;
  ELSE
    v_goal_id := NEW.goal_id;
    v_user_id := NEW.user_id;
  END IF;

  SELECT target_amount INTO v_target_amount
  FROM public.savings_goals
  WHERE id = v_goal_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END), 0)
  INTO
    v_total_deposits,
    v_total_withdraws
  FROM public.savings_contributions
  WHERE goal_id = v_goal_id AND user_id = v_user_id;

  v_computed_amount := GREATEST(0, v_total_deposits - v_total_withdraws);

  UPDATE public.savings_goals
  SET
    current_amount = v_computed_amount,
    status = CASE
      WHEN v_computed_amount >= v_target_amount THEN 'completed'
      ELSE 'active'
    END,
    updated_at = timezone('utc', now())
  WHERE id = v_goal_id AND user_id = v_user_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_savings_sync_contributions ON public.savings_contributions;
CREATE TRIGGER trg_savings_sync_contributions
  AFTER INSERT OR UPDATE OR DELETE ON public.savings_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_savings_goal_on_contribution();

-- ----------------------------------------------------------------------------
-- 4. TRIGGER: Sinkronisasi Otomatis `debts.remaining_amount` & `status`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_debt_on_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt_id UUID;
  v_user_id UUID;
  v_principal BIGINT;
  v_total_payments BIGINT;
  v_new_remaining BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_debt_id := OLD.debt_id;
    v_user_id := OLD.user_id;
  ELSE
    v_debt_id := NEW.debt_id;
    v_user_id := NEW.user_id;
  END IF;

  SELECT principal_amount INTO v_principal
  FROM public.debts
  WHERE id = v_debt_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_payments
  FROM public.debt_payments
  WHERE debt_id = v_debt_id AND user_id = v_user_id;

  v_new_remaining := GREATEST(0, v_principal - v_total_payments);

  UPDATE public.debts
  SET
    remaining_amount = v_new_remaining,
    status = CASE
      WHEN v_new_remaining <= 0 THEN 'paid'
      WHEN v_new_remaining < v_principal THEN 'partial'
      ELSE 'unpaid'
    END,
    updated_at = timezone('utc', now())
  WHERE id = v_debt_id AND user_id = v_user_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_debt_sync_payments ON public.debt_payments;
CREATE TRIGGER trg_debt_sync_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_debt_on_payment_change();

