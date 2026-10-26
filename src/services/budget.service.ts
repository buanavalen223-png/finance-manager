import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseClient } from '@/lib/supabase';
import { toSafeRupiahInteger } from '@/lib/currency';
import {
  budgetFormSchema,
  type BudgetFormValues,
} from '@/schemas/planning.schema';
import { stripClientOwnershipFields } from '@/services/profile.service';
import type { Budget } from '@/types/domain';
import type { BudgetRow } from '@/types/database.types';

export function mapBudgetRowToDomain(row: BudgetRow): Budget {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    amountLimit: toSafeRupiahInteger(Number(row.amount_limit)),
    alertThresholdPercent: row.alert_threshold_percent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Mengambil daftar anggaran pengguna pada periode bulan dan tahun tertentu.
 */
export async function fetchBudgets(
  authenticatedUserId: string,
  periodYear: number,
  periodMonth: number,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Budget[]> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const { data, error } = await client
    .from('budgets')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Gagal memuat anggaran bulanan.');
  }

  return ((data ?? []) as BudgetRow[]).map(mapBudgetRowToDomain);
}

/**
 * Membuat anggaran baru (baik per kategori spesifik maupun anggaran keseluruhan).
 */
export async function createBudget(
  authenticatedUserId: string,
  rawInput: BudgetFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Budget> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = budgetFormSchema.parse(stripped);
  const safeLimit = toSafeRupiahInteger(parsed.amountLimit);
  const targetCategory = parsed.categoryId ? parsed.categoryId.trim() : null;

  // Verifikasi kepemilikan kategori jika disetel
  if (targetCategory) {
    const { data: catRow, error: catErr } = await client
      .from('categories')
      .select('id, user_id, type')
      .eq('id', targetCategory)
      .eq('user_id', authenticatedUserId)
      .maybeSingle();

    if (catErr || !catRow) {
      throw new Error('Kategori anggaran tidak valid atau bukan milik akun Anda.');
    }
  }

  const insertPayload = {
    user_id: authenticatedUserId,
    category_id: targetCategory,
    period_year: parsed.periodYear,
    period_month: parsed.periodMonth,
    amount_limit: safeLimit,
    alert_threshold_percent: parsed.alertThresholdPercent,
  };

  const { data, error } = await client
    .from('budgets')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      error?.message?.includes('unique')
        ? 'Anggaran untuk kategori dan periode ini sudah ada.'
        : 'Gagal membuat anggaran baru.',
    );
  }

  return mapBudgetRowToDomain(data as BudgetRow);
}

/**
 * Memperbarui batas anggaran atau ambang batas peringatan.
 */
export async function updateBudget(
  authenticatedUserId: string,
  budgetId: string,
  rawInput: BudgetFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Budget> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!budgetId) {
    throw new Error('ID anggaran wajib diisi.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = budgetFormSchema.parse(stripped);
  const safeLimit = toSafeRupiahInteger(parsed.amountLimit);
  const targetCategory = parsed.categoryId ? parsed.categoryId.trim() : null;

  const { data, error } = await client
    .from('budgets')
    .update({
      category_id: targetCategory,
      amount_limit: safeLimit,
      alert_threshold_percent: parsed.alertThresholdPercent,
    })
    .eq('id', budgetId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal memperbarui anggaran.');
  }

  return mapBudgetRowToDomain(data as BudgetRow);
}

/**
 * Menghapus catatan anggaran.
 */
export async function deleteBudget(
  authenticatedUserId: string,
  budgetId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<void> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!budgetId) {
    throw new Error('ID anggaran wajib diisi.');
  }

  const { data, error } = await client
    .from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('user_id', authenticatedUserId)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Gagal menghapus anggaran.');
  }
}

