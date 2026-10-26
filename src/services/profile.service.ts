import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseClient } from '@/lib/supabase';
import type {
  NotificationPreferences,
  Profile,
} from '@/types/domain';
import type {
  NotificationPreferenceRow,
  ProfileRow,
} from '@/types/database.types';
import type {
  NotificationPreferencesFormValues,
  ProfileUpdateFormValues,
} from '@/schemas/auth.schema';

type ForbiddenOwnershipFields = Partial<
  Record<'id' | 'user_id' | 'userId' | 'created_at' | 'updated_at', unknown>
>;

/**
 * Menghapus properti kepemilikan (`id`, `user_id`, `userId`, `created_at`, `updated_at`)
 * yang mungkin disisipkan dari sisi klien agar penentuan `user_id` 100% dikendalikan
 * oleh sesi autentikasi (`auth.uid()`) dan trigger database.
 */
export function stripClientOwnershipFields<T extends object>(
  rawPayload: T & ForbiddenOwnershipFields,
): Omit<T, 'id' | 'user_id' | 'userId' | 'created_at' | 'updated_at'> {
  const clone = { ...rawPayload } as Record<string, unknown>;
  delete clone.id;
  delete clone.user_id;
  delete clone.userId;
  delete clone.created_at;
  delete clone.updated_at;
  return clone as Omit<
    T,
    'id' | 'user_id' | 'userId' | 'created_at' | 'updated_at'
  >;
}

export function mapProfileRowToDomain(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    currencyCode: row.currency_code,
    themePreference: row.theme_preference,
    locale: row.locale,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNotificationRowToDomain(
  row: NotificationPreferenceRow,
): NotificationPreferences {
  return {
    id: row.id,
    userId: row.user_id,
    budgetAlertEnabled: row.budget_alert_enabled,
    recurringReminderEnabled: row.recurring_reminder_enabled,
    debtReminderEnabled: row.debt_reminder_enabled,
    weeklySummaryEnabled: row.weekly_summary_enabled,
    reminderDaysBefore: row.reminder_days_before,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchUserProfile(
  authenticatedUserId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Profile | null> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', authenticatedUserId)
    .eq('user_id', authenticatedUserId)
    .maybeSingle();

  if (error) {
    throw new Error('Gagal memuat profil pengguna.');
  }

  if (!data) {
    return null;
  }

  return mapProfileRowToDomain(data as ProfileRow);
}

export async function updateUserProfile(
  authenticatedUserId: string,
  values: ProfileUpdateFormValues & ForbiddenOwnershipFields,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<Profile> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const safeValues = stripClientOwnershipFields(values);

  const { data, error } = await client
    .from('profiles')
    .update({
      full_name: safeValues.fullName.trim(),
      theme_preference: safeValues.themePreference,
    })
    .eq('id', authenticatedUserId)
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal menyimpan perubahan profil pengguna.');
  }

  return mapProfileRowToDomain(data as ProfileRow);
}

export async function fetchNotificationPreferences(
  authenticatedUserId: string,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<NotificationPreferences | null> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const { data, error } = await client
    .from('notification_preferences')
    .select('*')
    .eq('user_id', authenticatedUserId)
    .maybeSingle();

  if (error) {
    throw new Error('Gagal memuat preferensi notifikasi.');
  }

  if (!data) {
    return null;
  }

  return mapNotificationRowToDomain(data as NotificationPreferenceRow);
}

export async function updateNotificationPreferences(
  authenticatedUserId: string,
  values: NotificationPreferencesFormValues & ForbiddenOwnershipFields,
  client: SupabaseClient = requireSupabaseClient(),
): Promise<NotificationPreferences> {
  if (!authenticatedUserId) {
    throw new Error('Sesi pengguna tidak ditemukan.');
  }

  const safeValues = stripClientOwnershipFields(values);

  const { data, error } = await client
    .from('notification_preferences')
    .update({
      budget_alert_enabled: safeValues.budgetAlertEnabled,
      recurring_reminder_enabled: safeValues.recurringReminderEnabled,
      debt_reminder_enabled: safeValues.debtReminderEnabled,
      weekly_summary_enabled: safeValues.weeklySummaryEnabled,
      reminder_days_before: safeValues.reminderDaysBefore,
    })
    .eq('user_id', authenticatedUserId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Gagal menyimpan preferensi notifikasi.');
  }

  return mapNotificationRowToDomain(data as NotificationPreferenceRow);
}

