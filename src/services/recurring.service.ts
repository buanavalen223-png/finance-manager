import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseClient } from '@/lib/supabase';
import { toSafeRupiahInteger } from '@/lib/currency';
import { toISODateString } from '@/lib/date';
import { computeNextDueDate } from '@/lib/finance/planning';
import {
  recurringTransactionFormSchema,
  type RecurringTransactionFormValues,
} from '@/schemas/planning.schema';
import { stripClientOwnershipFields } from '@/services/profile.service';
import type { RecurringTransaction, Transaction } from '@/types/domain';
import type {
  RecurringTransactionRow,
  TransactionRow,
} from '@/types/database.types';
import { mapTransactionRowToDomain } from '@/services/transaction.service';

export function mapRecurringTransactionRowToDomain(
  row: RecurringTransactionRow,
): RecurringTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    categoryId: row.category_id,
    name: row.name,
    type: row.type,
    amount: toSafeRupiahInteger(Number(row.amount)),
    frequency: row.frequency,
    nextDueDate: row.next_due_date,
    lastExecutedDate: row.last_executed_date,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Mengambil daftar transaksi dan tagihan rutin berulang milik pengguna.
 */
export async function fetchRecurringTransactions(
  authenticatedUserId: string,
  options?: { isActiveOnly?: boolean },
  client: SupabaseClient = requireSupabaseClient(),
): Promise<RecurringTransaction[]> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  let query = client
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .order('next_due_date', { ascending: true });

  if (options?.isActiveOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Gagal memuat daftar tagihan & transaksi berulang.');
  }

  return ((data ?? []) as RecurringTransactionRow[]).map(
    mapRecurringTransactionRowToDomain,
  );
}

/**
 * Menambahkan jadwal transaksi berulang baru.
 */
export async function createRecurringTransaction(
  authenticatedUserId: string,
  rawInput: RecurringTransactionFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<RecurringTransaction> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = recurringTransactionFormSchema.parse(stripped);
  const safeAmount = toSafeRupiahInteger(parsed.amount);

  const insertPayload = {
    user_id: authenticatedUserId,
    name: parsed.name.trim(),
    type: parsed.type,
    amount: safeAmount,
    frequency: parsed.frequency,
    account_id: parsed.accountId ? parsed.accountId.trim() : null,
    category_id: parsed.categoryId ? parsed.categoryId.trim() : null,
    next_due_date: parsed.nextDueDate,
    last_executed_date: null,
    is_active: true,
    notes: parsed.notes?.trim() ?? '',
  };

  const { data, error } = await client
    .from('recurring_transactions')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal membuat jadwal transaksi berulang.');
  }

  return mapRecurringTransactionRowToDomain(data as RecurringTransactionRow);
}

/**
 * Memperbarui data transaksi berulang.
 */
export async function updateRecurringTransaction(
  authenticatedUserId: string,
  recurringId: string,
  rawInput: RecurringTransactionFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<RecurringTransaction> {
  if (!authenticatedUserId || !recurringId) {
    throw new Error('Parameter tidak valid.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = recurringTransactionFormSchema.parse(stripped);
  const safeAmount = toSafeRupiahInteger(parsed.amount);

  const { data, error } = await client
    .from('recurring_transactions')
    .update({
      name: parsed.name.trim(),
      type: parsed.type,
      amount: safeAmount,
      frequency: parsed.frequency,
      account_id: parsed.accountId ? parsed.accountId.trim() : null,
      category_id: parsed.categoryId ? parsed.categoryId.trim() : null,
      next_due_date: parsed.nextDueDate,
      notes: parsed.notes?.trim() ?? '',
    })
    .eq('id', recurringId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal memperbarui transaksi berulang.');
  }

  return mapRecurringTransactionRowToDomain(data as RecurringTransactionRow);
}

/**
 * Mengubah status aktif/nonaktif transaksi berulang.
 */
export async function toggleRecurringActive(
  authenticatedUserId: string,
  recurringId: string,
  isActive: boolean,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<RecurringTransaction> {
  if (!authenticatedUserId || !recurringId) {
    throw new Error('Parameter tidak valid.');
  }

  const { data, error } = await client
    .from('recurring_transactions')
    .update({ is_active: Boolean(isActive) })
    .eq('id', recurringId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal mengubah status aktif jadwal.');
  }

  return mapRecurringTransactionRowToDomain(data as RecurringTransactionRow);
}

/**
 * Menghapus jadwal transaksi berulang.
 */
export async function deleteRecurringTransaction(
  authenticatedUserId: string,
  recurringId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<void> {
  if (!authenticatedUserId || !recurringId) {
    throw new Error('Parameter tidak valid.');
  }

  const { data, error } = await client
    .from('recurring_transactions')
    .delete()
    .eq('id', recurringId)
    .eq('user_id', authenticatedUserId)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Gagal menghapus jadwal transaksi berulang.');
  }
}

/**
 * Mengeksekusi pencatatan riil transaksi berulang ("Catat Sekarang").
 * Idempoten: Membuat baris transaksi baru di `public.transactions` dan memajukan
 * `next_due_date` ke siklus berikutnya serta mencatat `last_executed_date`.
 */
export async function executeRecurringTransaction(
  authenticatedUserId: string,
  recurringId: string,
  executionDate: string = toISODateString(),
  overrideAccountId?: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<{ transaction: Transaction; recurring: RecurringTransaction }> {
  if (!authenticatedUserId || !recurringId) {
    throw new Error('Parameter tidak valid.');
  }

  // 1. Ambil data jadwal berulang
  const { data: recRow, error: recErr } = await client
    .from('recurring_transactions')
    .select('*')
    .eq('id', recurringId)
    .eq('user_id', authenticatedUserId)
    .single();

  if (recErr || !recRow) {
    throw new Error('Jadwal transaksi berulang tidak ditemukan.');
  }

  const recurringItem = mapRecurringTransactionRowToDomain(
    recRow as RecurringTransactionRow,
  );

  const accountIdToUse = overrideAccountId || recurringItem.accountId;
  if (!accountIdToUse) {
    throw new Error(
      'Pilih rekening sumber/tujuan untuk mencatat transaksi ini ke buku besar.',
    );
  }

  // 2. Buat transaksi riil di buku besar
  const txPayload = {
    user_id: authenticatedUserId,
    account_id: accountIdToUse,
    category_id: recurringItem.categoryId,
    type: recurringItem.type,
    amount: recurringItem.amount,
    transaction_date: executionDate,
    description: `Eksekusi Rutin: ${recurringItem.name}`,
    source: 'recurring',
    reference_id: recurringItem.id,
  };

  const { data: txData, error: txErr } = await client
    .from('transactions')
    .insert(txPayload)
    .select('*')
    .single();

  if (txErr || !txData) {
    throw new Error('Gagal mencatat transaksi eksekusi berulang ke buku besar.');
  }

  // 3. Majukan tanggal jatuh tempo berikutnya
  const nextDueDate = computeNextDueDate(
    recurringItem.nextDueDate,
    recurringItem.frequency,
  );

  const { data: updatedRec, error: updatedRecErr } = await client
    .from('recurring_transactions')
    .update({
      next_due_date: nextDueDate,
      last_executed_date: executionDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recurringItem.id)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (updatedRecErr || !updatedRec) {
    throw new Error('Gagal memajukan tanggal siklus berikutnya.');
  }

  return {
    transaction: mapTransactionRowToDomain(txData as TransactionRow),
    recurring: mapRecurringTransactionRowToDomain(
      updatedRec as RecurringTransactionRow,
    ),
  };
}

