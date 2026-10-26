import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseClient } from '@/lib/supabase';
import {
  categoryFormSchema,
  type CategoryFormValues,
} from '@/schemas/category.schema';
import { stripClientOwnershipFields } from '@/services/profile.service';
import type { Category } from '@/types/domain';
import type { CategoryRow } from '@/types/database.types';

export const DEFAULT_SYSTEM_CATEGORIES: ReadonlyArray<{
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}> = [
  {
    name: 'Gaji & Penghasilan Utama',
    type: 'income',
    color: '#176B52',
    icon: 'briefcase',
  },
  {
    name: 'Bonus & Proyek Freelance',
    type: 'income',
    color: '#2B8A6E',
    icon: 'sparkles',
  },
  {
    name: 'Makanan & Minuman',
    type: 'expense',
    color: '#176B52',
    icon: 'utensils',
  },
  {
    name: 'Transportasi',
    type: 'expense',
    color: '#4E7D6E',
    icon: 'car',
  },
  {
    name: 'Hunian & Tagihan Utilitas',
    type: 'expense',
    color: '#2E5A4C',
    icon: 'home',
  },
  {
    name: 'Belanja Kebutuhan Rumah',
    type: 'expense',
    color: '#789E90',
    icon: 'shopping-bag',
  },
  {
    name: 'Kesehatan & Olahraga',
    type: 'expense',
    color: '#A3BFB5',
    icon: 'heart-pulse',
  },
  {
    name: 'Pendidikan & Pengembangan',
    type: 'expense',
    color: '#3B6E5C',
    icon: 'book-open',
  },
];

export function mapCategoryRowToDomain(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    color: row.color,
    icon: row.icon,
    isSystem: row.is_system,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Memuat daftar kategori milik pengguna. Jika pengguna baru belum memiliki
 * kategori sama sekali, menginisialisasi kategori bawaan secara idempoten.
 */
export async function fetchCategories(
  authenticatedUserId: string,
  options?: { includeArchived?: boolean },
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Category[]> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  let query = client
    .from('categories')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .order('is_system', { ascending: false })
    .order('name', { ascending: true });

  if (!options?.includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Gagal memuat daftar kategori transaksi.');
  }

  const rows = (data ?? []) as CategoryRow[];
  return rows.map(mapCategoryRowToDomain);
}

/**
 * Menjamin kategori default tersedia untuk pengguna (idempoten).
 */
export async function ensureDefaultCategories(
  authenticatedUserId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Category[]> {
  const existing = await fetchCategories(
    authenticatedUserId,
    { includeArchived: true },
    client,
  );
  if (existing.length > 0) {
    return existing.filter((c) => !c.isArchived);
  }

  const seedPayloads = DEFAULT_SYSTEM_CATEGORIES.map((item) => ({
    user_id: authenticatedUserId,
    name: item.name,
    type: item.type,
    color: item.color,
    icon: item.icon,
    is_system: true,
    is_archived: false,
  }));

  const { data, error } = await client
    .from('categories')
    .insert(seedPayloads)
    .select('*');

  if (error || !data) {
    return [];
  }

  return (data as CategoryRow[]).map(mapCategoryRowToDomain);
}

/**
 * Membuat kategori kustom baru (`income` atau `expense`).
 */
export async function createCategory(
  authenticatedUserId: string,
  rawInput: CategoryFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Category> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = categoryFormSchema.parse(stripped);

  const { data, error } = await client
    .from('categories')
    .insert({
      user_id: authenticatedUserId,
      name: parsed.name.trim(),
      type: parsed.type,
      color: parsed.color,
      icon: parsed.icon,
      is_system: false,
      is_archived: false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal membuat kategori baru.');
  }

  return mapCategoryRowToDomain(data as CategoryRow);
}

/**
 * Memperbarui nama, warna, atau ikon kategori milik pengguna.
 */
export async function updateCategory(
  authenticatedUserId: string,
  categoryId: string,
  rawInput: CategoryFormValues & Record<string, unknown>,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Category> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!categoryId) {
    throw new Error('ID kategori wajib diisi.');
  }

  const stripped = stripClientOwnershipFields(rawInput);
  const parsed = categoryFormSchema.parse(stripped);

  const { data, error } = await client
    .from('categories')
    .update({
      name: parsed.name.trim(),
      type: parsed.type,
      color: parsed.color,
      icon: parsed.icon,
    })
    .eq('id', categoryId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal memperbarui kategori.');
  }

  return mapCategoryRowToDomain(data as CategoryRow);
}

/**
 * Mengarsipkan atau mengaktifkan kembali kategori tanpa merusak transaksi historis.
 */
export async function setCategoryArchived(
  authenticatedUserId: string,
  categoryId: string,
  isArchived: boolean,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Category> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }
  if (!categoryId) {
    throw new Error('ID kategori wajib diisi.');
  }

  const { data, error } = await client
    .from('categories')
    .update({ is_archived: Boolean(isArchived) })
    .eq('id', categoryId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal mengubah status arsip kategori.');
  }

  return mapCategoryRowToDomain(data as CategoryRow);
}

