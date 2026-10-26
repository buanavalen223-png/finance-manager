import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseClient } from '@/lib/supabase';
import { toSafeRupiahInteger } from '@/lib/currency';
import {
  savingsContributionFormSchema,
  savingsGoalFormSchema,
  type SavingsContributionFormValues,
  type SavingsGoalFormValues,
} from '@/schemas/planning.schema';
import { stripClientOwnershipFields } from '@/services/profile.service';
import type { SavingsContribution, SavingsGoal } from '@/types/domain';
import type {
  SavingsContributionRow,
  SavingsGoalRow,
} from '@/types/database.types';

export function mapSavingsGoalRowToDomain(row: SavingsGoalRow): SavingsGoal {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    name: row.name,
    targetAmount: toSafeRupiahInteger(Number(row.target_amount)),
    currentAmount: toSafeRupiahInteger(Number(row.current_amount)),
    targetDate: row.target_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSavingsContributionRowToDomain(
  row: SavingsContributionRow,
): SavingsContribution {
  return {
    id: row.id,
    userId: row.user_id,
    goalId: row.goal_id,
    accountId: row.account_id,
    amount: toSafeRupiahInteger(Number(row.amount)),
    type: row.type,
    contributionDate: row.contribution_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Mengambil daftar target tabungan milik pengguna.
 */
export async function fetchSavingsGoals(
  authenticatedUserId: string,
  options?: { status?: 'all' | 'active' | 'completed' | 'cancelled' },
  client: SupabaseClient = requireSupabaseClient(),
): Promise<SavingsGoal[]> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  let query = client
    .from('savings_goals')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .order('created_at', { ascending: false });

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Gagal memuat target tabungan.');
  }

  return ((data ?? []) as SavingsGoalRow[]).map(mapSavingsGoalRowToDomain);
}

/**
 * Membuat target tabungan baru.
 */
export async function createSavingsGoal(
  authenticatedUserId: string,
  rawInput: SavingsGoalFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<SavingsGoal> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = savingsGoalFormSchema.parse(stripped);
  const safeTarget = toSafeRupiahInteger(parsed.targetAmount);
  const safeInitial = toSafeRupiahInteger(parsed.currentAmount || 0);

  const insertPayload = {
    user_id: authenticatedUserId,
    name: parsed.name.trim(),
    target_amount: safeTarget,
    current_amount: safeInitial,
    target_date: parsed.targetDate ? parsed.targetDate.trim() : null,
    account_id: parsed.accountId ? parsed.accountId.trim() : null,
    notes: parsed.notes?.trim() ?? '',
    status: safeInitial >= safeTarget ? 'completed' : 'active',
  };

  const { data, error } = await client
    .from('savings_goals')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal membuat target tabungan baru.');
  }

  return mapSavingsGoalRowToDomain(data as SavingsGoalRow);
}

/**
 * Memperbarui data target tabungan.
 */
export async function updateSavingsGoal(
  authenticatedUserId: string,
  goalId: string,
  rawInput: SavingsGoalFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<SavingsGoal> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!goalId) {
    throw new Error('ID target tabungan wajib diisi.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = savingsGoalFormSchema.parse(stripped);
  const safeTarget = toSafeRupiahInteger(parsed.targetAmount);

  const { data, error } = await client
    .from('savings_goals')
    .update({
      name: parsed.name.trim(),
      target_amount: safeTarget,
      target_date: parsed.targetDate ? parsed.targetDate.trim() : null,
      account_id: parsed.accountId ? parsed.accountId.trim() : null,
      notes: parsed.notes?.trim() ?? '',
    })
    .eq('id', goalId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal memperbarui target tabungan.');
  }

  return mapSavingsGoalRowToDomain(data as SavingsGoalRow);
}

/**
 * Menghapus target tabungan.
 */
export async function deleteSavingsGoal(
  authenticatedUserId: string,
  goalId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<void> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!goalId) {
    throw new Error('ID target tabungan wajib diisi.');
  }

  const { data, error } = await client
    .from('savings_goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', authenticatedUserId)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Gagal menghapus target tabungan.');
  }
}

/**
 * Mengambil riwayat kontribusi untuk target tabungan tertentu.
 */
export async function fetchSavingsContributions(
  authenticatedUserId: string,
  goalId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<SavingsContribution[]> {
  if (!authenticatedUserId || !goalId) {
    throw new Error('Parameter tidak valid.');
  }

  const { data, error } = await client
    .from('savings_contributions')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .eq('goal_id', goalId)
    .order('contribution_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Gagal memuat riwayat alokasi tabungan.');
  }

  return ((data ?? []) as SavingsContributionRow[]).map(
    mapSavingsContributionRowToDomain,
  );
}

/**
 * Mencatat penambahan (deposit) atau penarikan (withdraw) alokasi tabungan.
 * Mengupdate `savings_goals.current_amount` secara konsisten.
 */
export async function recordSavingsContribution(
  authenticatedUserId: string,
  goalId: string,
  rawInput: SavingsContributionFormValues &
    Record<string, unknown> & { linkToAccountMutation?: boolean },
  client: SupabaseClient = requireSupabaseClient(),
): Promise<SavingsContribution> {
  if (!authenticatedUserId || !goalId) {
    throw new Error('Parameter tidak valid.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = savingsContributionFormSchema.parse(stripped);
  const safeAmount = toSafeRupiahInteger(parsed.amount);

  // 1. Verifikasi kepemilikan target tabungan
  const { data: goalRow, error: goalErr } = await client
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', authenticatedUserId)
    .single();

  if (goalErr || !goalRow) {
    throw new Error('Target tabungan tidak ditemukan.');
  }

  const currentAmount = toSafeRupiahInteger(
    Number((goalRow as SavingsGoalRow).current_amount),
  );
  const targetAmount = toSafeRupiahInteger(
    Number((goalRow as SavingsGoalRow).target_amount),
  );

  if (parsed.type === 'withdraw' && safeAmount > currentAmount) {
    throw new Error('Nominal penarikan melebihi saldo tabungan saat ini.');
  }

  // 2. Insert record kontribusi
  const insertPayload = {
    user_id: authenticatedUserId,
    goal_id: goalId,
    account_id: parsed.accountId ? parsed.accountId.trim() : null,
    amount: safeAmount,
    type: parsed.type,
    contribution_date: parsed.contributionDate,
    notes: parsed.notes?.trim() ?? '',
  };

  const { data: contribData, error: contribErr } = await client
    .from('savings_contributions')
    .insert(insertPayload)
    .select('*')
    .single();

  if (contribErr || !contribData) {
    throw new Error('Gagal mencatat mutasi alokasi tabungan.');
  }

  // 3. Update current_amount dan status tabungan secara konsisten
  const nextAmount =
    parsed.type === 'deposit'
      ? currentAmount + safeAmount
      : Math.max(0, currentAmount - safeAmount);

  await client
    .from('savings_goals')
    .update({
      current_amount: nextAmount,
      status: nextAmount >= targetAmount ? 'completed' : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .eq('user_id', authenticatedUserId);

  return mapSavingsContributionRowToDomain(
    contribData as SavingsContributionRow,
  );
}

