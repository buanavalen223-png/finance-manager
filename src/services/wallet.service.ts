import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseClient } from '@/lib/supabase';
import { toSafeRupiahInteger } from '@/lib/currency';
import { walletFormSchema, type WalletFormValues } from '@/schemas/wallet.schema';
import { stripClientOwnershipFields } from '@/services/profile.service';
import type { Account } from '@/types/domain';
import type { AccountRow } from '@/types/database.types';

export function mapAccountRowToDomain(row: AccountRow): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    currencyCode: row.currency_code,
    initialBalance: toSafeRupiahInteger(Number(row.initial_balance)),
    currentBalance: toSafeRupiahInteger(Number(row.current_balance)),
    color: row.color,
    icon: row.icon,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Mengambil seluruh daftar rekening milik pengguna yang sedang terautentikasi.
 */
export async function fetchWallets(
  authenticatedUserId: string,
  options?: { includeArchived?: boolean },
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Account[]> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  let query = client
    .from('accounts')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .order('is_archived', { ascending: true })
    .order('created_at', { ascending: true });

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Gagal memuat daftar rekening & dompet.');
  }

  return ((data ?? []) as AccountRow[]).map(mapAccountRowToDomain);
}

/**
 * Menambahkan rekening baru dengan saldo awal (`initial_balance`).
 * `current_balance` tidak pernah diambil dari total klaim client, melainkan
 * diinisialisasi sama dengan `initial_balance` dan dijaga oleh trigger database.
 */
export async function createWallet(
  authenticatedUserId: string,
  rawInput: WalletFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Account> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = walletFormSchema.parse(stripped);
  const safeInitialBalance = toSafeRupiahInteger(parsed.initialBalance);

  const { data, error } = await client
    .from('accounts')
    .insert({
      user_id: authenticatedUserId,
      name: parsed.name.trim(),
      type: parsed.type,
      currency_code: 'IDR',
      initial_balance: safeInitialBalance,
      current_balance: safeInitialBalance,
      color: parsed.color,
      icon: parsed.icon,
      is_archived: false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal membuat rekening baru.');
  }

  return mapAccountRowToDomain(data as AccountRow);
}

/**
 * Memperbarui informasi rekening (nama, jenis, warna, ikon, dan saldo awal).
 * Penting: `current_balance` TIDAK dikirim dari client; jika `initial_balance`
 * berubah, saldo berjalan disesuaikan dari selisih `initial_balance` baru vs lama.
 */
export async function updateWallet(
  authenticatedUserId: string,
  walletId: string,
  rawInput: WalletFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Account> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!walletId) {
    throw new Error('ID rekening wajib diisi.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = walletFormSchema.parse(stripped);
  const nextInitialBalance = toSafeRupiahInteger(parsed.initialBalance);

  // Verifikasi kepemilikan rekening terlebih dahulu
  const { data: existingRow, error: existingErr } = await client
    .from('accounts')
    .select('*')
    .eq('id', walletId)
    .eq('user_id', authenticatedUserId)
    .single();

  if (existingErr || !existingRow) {
    throw new Error('Rekening tidak ditemukan atau Anda tidak memiliki akses.');
  }

  const oldInitial = toSafeRupiahInteger(
    Number((existingRow as AccountRow).initial_balance),
  );
  const oldCurrent = toSafeRupiahInteger(
    Number((existingRow as AccountRow).current_balance),
  );
  const deltaInitial = nextInitialBalance - oldInitial;
  const computedNextCurrent = toSafeRupiahInteger(oldCurrent + deltaInitial);

  const { data, error } = await client
    .from('accounts')
    .update({
      name: parsed.name.trim(),
      type: parsed.type,
      initial_balance: nextInitialBalance,
      current_balance: computedNextCurrent,
      color: parsed.color,
      icon: parsed.icon,
    })
    .eq('id', walletId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal memperbarui data rekening.');
  }

  return mapAccountRowToDomain(data as AccountRow);
}

/**
 * Mengarsipkan atau memulihkan rekening (`is_archived`).
 */
export async function setWalletArchived(
  authenticatedUserId: string,
  walletId: string,
  isArchived: boolean,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Account> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!walletId) {
    throw new Error('ID rekening wajib diisi.');
  }

  const { data, error } = await client
    .from('accounts')
    .update({ is_archived: Boolean(isArchived) })
    .eq('id', walletId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal mengubah status arsip rekening.');
  }

  return mapAccountRowToDomain(data as AccountRow);
}

