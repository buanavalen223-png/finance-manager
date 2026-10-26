import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseClient } from '@/lib/supabase';
import { toSafeRupiahInteger } from '@/lib/currency';
import {
  debtFormSchema,
  debtPaymentFormSchema,
  type DebtFormValues,
  type DebtPaymentFormValues,
} from '@/schemas/planning.schema';
import { stripClientOwnershipFields } from '@/services/profile.service';
import type { DebtPayment, DebtRecord, DebtType } from '@/types/domain';
import type { DebtPaymentRow, DebtRow } from '@/types/database.types';

export function mapDebtRowToDomain(row: DebtRow): DebtRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    counterpartyName: row.counterparty_name,
    principalAmount: toSafeRupiahInteger(Number(row.principal_amount)),
    remainingAmount: toSafeRupiahInteger(Number(row.remaining_amount)),
    dueDate: row.due_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDebtPaymentRowToDomain(row: DebtPaymentRow): DebtPayment {
  return {
    id: row.id,
    userId: row.user_id,
    debtId: row.debt_id,
    transactionId: row.transaction_id,
    amount: toSafeRupiahInteger(Number(row.amount)),
    paymentDate: row.payment_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Mengambil daftar catatan utang & piutang pengguna.
 */
export async function fetchDebts(
  authenticatedUserId: string,
  options?: {
    type?: 'all' | DebtType;
    status?: 'all' | 'unpaid' | 'partial' | 'paid';
  },
  client: SupabaseClient = requireSupabaseClient(),
): Promise<DebtRecord[]> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  let query = client
    .from('debts')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .order('created_at', { ascending: false });

  if (options?.type && options.type !== 'all') {
    query = query.eq('type', options.type);
  }
  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Gagal memuat catatan utang & piutang.');
  }

  return ((data ?? []) as DebtRow[]).map(mapDebtRowToDomain);
}

/**
 * Membuat catatan utang atau piutang baru.
 */
export async function createDebt(
  authenticatedUserId: string,
  rawInput: DebtFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<DebtRecord> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = debtFormSchema.parse(stripped);
  const safePrincipal = toSafeRupiahInteger(parsed.principalAmount);

  const insertPayload = {
    user_id: authenticatedUserId,
    type: parsed.type,
    counterparty_name: parsed.counterpartyName.trim(),
    principal_amount: safePrincipal,
    remaining_amount: safePrincipal,
    due_date: parsed.dueDate ? parsed.dueDate.trim() : null,
    status: 'unpaid',
    notes: parsed.notes?.trim() ?? '',
  };

  const { data, error } = await client
    .from('debts')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal membuat catatan utang/piutang.');
  }

  return mapDebtRowToDomain(data as DebtRow);
}

/**
 * Memperbarui catatan utang / piutang (pihak terkait, tanggal jatuh tempo, catatan).
 */
export async function updateDebt(
  authenticatedUserId: string,
  debtId: string,
  rawInput: DebtFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<DebtRecord> {
  if (!authenticatedUserId || !debtId) {
    throw new Error('Parameter tidak valid.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = debtFormSchema.parse(stripped);

  const { data, error } = await client
    .from('debts')
    .update({
      counterparty_name: parsed.counterpartyName.trim(),
      due_date: parsed.dueDate ? parsed.dueDate.trim() : null,
      notes: parsed.notes?.trim() ?? '',
    })
    .eq('id', debtId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal memperbarui catatan utang/piutang.');
  }

  return mapDebtRowToDomain(data as DebtRow);
}

/**
 * Menghapus catatan utang / piutang beserta riwayat pembayarannya.
 */
export async function deleteDebt(
  authenticatedUserId: string,
  debtId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<void> {
  if (!authenticatedUserId || !debtId) {
    throw new Error('Parameter tidak valid.');
  }

  const { data, error } = await client
    .from('debts')
    .delete()
    .eq('id', debtId)
    .eq('user_id', authenticatedUserId)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Gagal menghapus catatan utang/piutang.');
  }
}

/**
 * Mengambil riwayat cicilan / pembayaran untuk catatan utang tertentu.
 */
export async function fetchDebtPayments(
  authenticatedUserId: string,
  debtId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<DebtPayment[]> {
  if (!authenticatedUserId || !debtId) {
    throw new Error('Parameter tidak valid.');
  }

  const { data, error } = await client
    .from('debt_payments')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .eq('debt_id', debtId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Gagal memuat riwayat pembayaran utang.');
  }

  return ((data ?? []) as DebtPaymentRow[]).map(mapDebtPaymentRowToDomain);
}

/**
 * Mencatat pembayaran cicilan atau pelunasan utang / piutang secara atomik.
 * Menghitung sisa kewajiban dan status secara konsisten, serta mencegah pembayaran melebihi sisa.
 */
export async function recordDebtPayment(
  authenticatedUserId: string,
  debtId: string,
  rawInput: DebtPaymentFormValues &
    Record<string, unknown> & { linkToAccount?: boolean },
  client: SupabaseClient = requireSupabaseClient(),
): Promise<DebtPayment> {
  if (!authenticatedUserId || !debtId) {
    throw new Error('Parameter tidak valid.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = debtPaymentFormSchema.parse(stripped);
  const safeAmount = toSafeRupiahInteger(parsed.amount);

  // 1. Ambil catatan utang & validasi kepemilikan
  const { data: debtRow, error: debtErr } = await client
    .from('debts')
    .select('*')
    .eq('id', debtId)
    .eq('user_id', authenticatedUserId)
    .single();

  if (debtErr || !debtRow) {
    throw new Error('Catatan utang/piutang tidak ditemukan.');
  }

  const currentRemaining = toSafeRupiahInteger(
    Number((debtRow as DebtRow).remaining_amount),
  );
  const principalAmount = toSafeRupiahInteger(
    Number((debtRow as DebtRow).principal_amount),
  );

  if (currentRemaining <= 0) {
    throw new Error('Kewajiban ini sudah lunas sepenuhnya.');
  }

  if (safeAmount > currentRemaining) {
    throw new Error(
      `Nominal pembayaran (Rp ${safeAmount.toLocaleString('id-ID')}) melebihi sisa kewajiban (Rp ${currentRemaining.toLocaleString('id-ID')}).`,
    );
  }

  let transactionId: string | null = null;

  // 2. Jika akun rekening dipilih, buat transaksi keuangan terkait
  if (parsed.accountId && rawInput.linkToAccount) {
    const isPayable = (debtRow as DebtRow).type === 'payable';
    const txType = isPayable ? 'expense' : 'income';
    const txDesc = isPayable
      ? `Bayar Utang: ${(debtRow as DebtRow).counterparty_name}`
      : `Terima Piutang: ${(debtRow as DebtRow).counterparty_name}`;

    const { data: txData, error: txErr } = await client
      .from('transactions')
      .insert({
        user_id: authenticatedUserId,
        account_id: parsed.accountId,
        type: txType,
        amount: safeAmount,
        transaction_date: parsed.paymentDate,
        description: txDesc,
        source: 'debt_payment',
        reference_id: debtId,
      })
      .select('id')
      .single();

    if (!txErr && txData) {
      transactionId = (txData as { id: string }).id;
    }
  }

  // 3. Simpan riwayat pembayaran
  const paymentPayload = {
    user_id: authenticatedUserId,
    debt_id: debtId,
    transaction_id: transactionId,
    amount: safeAmount,
    payment_date: parsed.paymentDate,
    notes: parsed.notes?.trim() ?? '',
  };

  const { data: paymentData, error: paymentErr } = await client
    .from('debt_payments')
    .insert(paymentPayload)
    .select('*')
    .single();

  if (paymentErr || !paymentData) {
    throw new Error('Gagal mencatat pembayaran utang/piutang.');
  }

  // 4. Update remaining_amount dan status pada tabel debts
  const newRemaining = Math.max(0, currentRemaining - safeAmount);
  const newStatus =
    newRemaining <= 0
      ? 'paid'
      : newRemaining < principalAmount
        ? 'partial'
        : 'unpaid';

  await client
    .from('debts')
    .update({
      remaining_amount: newRemaining,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', debtId)
    .eq('user_id', authenticatedUserId);

  return mapDebtPaymentRowToDomain(paymentData as DebtPaymentRow);
}

