import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseClient } from '@/lib/supabase';
import { toSafeRupiahInteger } from '@/lib/currency';
import { assertValidTransactionEffect } from '@/lib/finance/ledger';
import {
  transactionFormSchema,
  type TransactionFilterParams,
  type TransactionFormValues,
} from '@/schemas/transaction.schema';
import { stripClientOwnershipFields } from '@/services/profile.service';
import type { Transaction, TransactionSource } from '@/types/domain';
import type { TransactionRow } from '@/types/database.types';

export interface PaginatedTransactionsResult {
  items: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function mapTransactionRowToDomain(row: TransactionRow): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    destinationAccountId: row.destination_account_id,
    categoryId: row.category_id,
    type: row.type,
    amount: toSafeRupiahInteger(Number(row.amount)),
    transactionDate: row.transaction_date,
    description: row.description,
    source: row.source,
    referenceId: row.reference_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Memastikan rekening sumber, rekening tujuan (jika transfer), dan kategori
 * (jika pemasukan/pengeluaran) benar-benar milik pengguna yang terautentikasi.
 */
async function verifyTransactionReferencesOwnership(
  authenticatedUserId: string,
  parsed: TransactionFormValues,
  client: SupabaseClient,
): Promise<void> {
  const accountIdsToCheck = [parsed.accountId];
  if (parsed.type === 'transfer' && parsed.destinationAccountId) {
    accountIdsToCheck.push(parsed.destinationAccountId);
  }

  for (const accId of accountIdsToCheck) {
    const { data: accRow, error: accErr } = await client
      .from('accounts')
      .select('id, user_id')
      .eq('id', accId)
      .eq('user_id', authenticatedUserId)
      .maybeSingle();

    if (accErr || !accRow) {
      throw new Error(
        'Rekening yang dipilih tidak valid atau bukan milik akun Anda.',
      );
    }
  }

  if (parsed.type !== 'transfer' && parsed.categoryId) {
    const { data: catRow, error: catErr } = await client
      .from('categories')
      .select('id, user_id, type')
      .eq('id', parsed.categoryId)
      .eq('user_id', authenticatedUserId)
      .maybeSingle();

    if (catErr || !catRow) {
      throw new Error(
        'Kategori yang dipilih tidak valid atau bukan milik akun Anda.',
      );
    }

    if ((catRow as { type: string }).type !== parsed.type) {
      throw new Error(
        'Jenis kategori harus sesuai dengan jenis transaksi (Pemasukan/Pengeluaran).',
      );
    }
  }
}

/**
 * Mengambil daftar transaksi milik pengguna dengan dukungan filter periode,
 * jenis transaksi, kategori, rekening (termasuk sebagai tujuan transfer),
 * kata kunci pencarian, dan pagination.
 */
export async function fetchTransactions(
  authenticatedUserId: string,
  filters: TransactionFilterParams = {},
  client: SupabaseClient = requireSupabaseClient(),
): Promise<PaginatedTransactionsResult> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 20));

  let query = client
    .from('transactions')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.type && filters.type !== 'all') {
    query = query.eq('type', filters.type);
  }
  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }
  if (filters.startDate) {
    query = query.gte('transaction_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('transaction_date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Gagal memuat riwayat transaksi.');
  }

  let domainItems = ((data ?? []) as TransactionRow[]).map(
    mapTransactionRowToDomain,
  );

  // Filter rekening: mencakup transaksi di mana rekening menjadi sumber ATAU tujuan transfer
  if (filters.accountId) {
    domainItems = domainItems.filter(
      (tx) =>
        tx.accountId === filters.accountId ||
        tx.destinationAccountId === filters.accountId,
    );
  }

  // Pencarian kata kunci pada catatan/deskripsi
  if (filters.search && filters.search.trim()) {
    const keyword = filters.search.trim().toLowerCase();
    domainItems = domainItems.filter((tx) =>
      tx.description.toLowerCase().includes(keyword),
    );
  }

  const totalCount = domainItems.length;
  const startIndex = (page - 1) * pageSize;
  const pagedItems = domainItems.slice(startIndex, startIndex + pageSize);

  return {
    items: pagedItems,
    totalCount,
    page,
    pageSize,
    hasMore: startIndex + pagedItems.length < totalCount,
  };
}

/**
 * Mencatat transaksi baru (`income`, `expense`, atau `transfer`).
 * Mutasi saldo rekening ditangani secara atomik oleh trigger PostgreSQL
 * `sync_account_balance_on_transaction` pada tabel `public.transactions`.
 */
export async function createTransaction(
  authenticatedUserId: string,
  rawInput: TransactionFormValues &
    Record<string, unknown> & { source?: TransactionSource },
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Transaction> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = transactionFormSchema.parse(stripped);
  const safeAmount = toSafeRupiahInteger(parsed.amount);

  assertValidTransactionEffect({
    type: parsed.type,
    amount: safeAmount,
    accountId: parsed.accountId,
    destinationAccountId:
      parsed.type === 'transfer' ? parsed.destinationAccountId : null,
  });

  await verifyTransactionReferencesOwnership(
    authenticatedUserId,
    parsed,
    client,
  );

  const insertPayload = {
    user_id: authenticatedUserId,
    account_id: parsed.accountId,
    destination_account_id:
      parsed.type === 'transfer' ? (parsed.destinationAccountId ?? null) : null,
    category_id:
      parsed.type === 'transfer' ? null : (parsed.categoryId ?? null),
    type: parsed.type,
    amount: safeAmount,
    transaction_date: parsed.transactionDate,
    description: parsed.description.trim(),
    source: rawInput.source ?? 'manual',
  };

  const { data, error } = await client
    .from('transactions')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal menyimpan transaksi ke buku besar.');
  }

  return mapTransactionRowToDomain(data as TransactionRow);
}

/**
 * Memperbarui transaksi yang sudah ada (`income`, `expense`, atau `transfer`).
 * Trigger PostgreSQL `sync_account_balance_on_transaction` secara otomatis
 * membatalkan efek transaksi lama (`OLD`) dan menerapkan efek transaksi baru (`NEW`)
 * secara atomik dalam satu transaksi database.
 */
export async function updateTransaction(
  authenticatedUserId: string,
  transactionId: string,
  rawInput: TransactionFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Transaction> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!transactionId) {
    throw new Error('ID transaksi wajib diisi.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = transactionFormSchema.parse(stripped);
  const safeAmount = toSafeRupiahInteger(parsed.amount);

  assertValidTransactionEffect({
    type: parsed.type,
    amount: safeAmount,
    accountId: parsed.accountId,
    destinationAccountId:
      parsed.type === 'transfer' ? parsed.destinationAccountId : null,
  });

  await verifyTransactionReferencesOwnership(
    authenticatedUserId,
    parsed,
    client,
  );

  const updatePayload = {
    account_id: parsed.accountId,
    destination_account_id:
      parsed.type === 'transfer' ? (parsed.destinationAccountId ?? null) : null,
    category_id:
      parsed.type === 'transfer' ? null : (parsed.categoryId ?? null),
    type: parsed.type,
    amount: safeAmount,
    transaction_date: parsed.transactionDate,
    description: parsed.description.trim(),
  };

  const { data, error } = await client
    .from('transactions')
    .update(updatePayload)
    .eq('id', transactionId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      'Gagal memperbarui transaksi. Pastikan transaksi milik akun Anda.',
    );
  }

  return mapTransactionRowToDomain(data as TransactionRow);
}

/**
 * Menghapus transaksi milik pengguna dan mengembalikan saldo rekening terkait
 * secara atomik melalui trigger database.
 */
export async function deleteTransaction(
  authenticatedUserId: string,
  transactionId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<void> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!transactionId) {
    throw new Error('ID transaksi wajib diisi.');
  }

  const { data, error } = await client
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', authenticatedUserId)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      'Gagal menghapus transaksi. Transaksi tidak ditemukan atau bukan milik Anda.',
    );
  }
}

