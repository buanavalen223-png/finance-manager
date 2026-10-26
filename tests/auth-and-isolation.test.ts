import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveProtectedRouteDecision } from '../src/components/common/ProtectedRoute';
import {
  forgotPasswordSchema,
  loginSchema,
  notificationPreferencesSchema,
  profileUpdateSchema,
  registerSchema,
} from '../src/schemas/auth.schema';
import { mapSupabaseAuthError } from '../src/services/auth.service';
import {
  fetchNotificationPreferences,
  fetchUserProfile,
  stripClientOwnershipFields,
  updateNotificationPreferences,
  updateUserProfile,
} from '../src/services/profile.service';
import type {
  NotificationPreferenceRow,
  ProfileRow,
} from '../src/types/database.types';

/**
 * Simulator klien Supabase yang menegakkan aturan RLS `auth.uid() = user_id`
 * untuk menguji isolasi data lintas-pengguna dan operasi CRUD dasar.
 */
function createRlsSimulatingSupabaseClient(
  activeAuthUid: string,
  db: {
    profiles: ProfileRow[];
    notification_preferences: NotificationPreferenceRow[];
  },
): SupabaseClient {
  const client = {
    from(table: 'profiles' | 'notification_preferences') {
      const filters: Record<string, string> = {};
      let pendingUpdate: Record<string, unknown> | null = null;

      const applyFilters = <T extends { user_id: string; id?: string }>(
        rows: T[],
      ): T[] => {
        return rows.filter((row) => {
          // Simulasi PostgreSQL RLS: auth.uid() = user_id
          if (row.user_id !== activeAuthUid) {
            return false;
          }
          for (const [col, val] of Object.entries(filters)) {
            if ((row as Record<string, unknown>)[col] !== val) {
              return false;
            }
          }
          return true;
        });
      };

      const builder = {
        select() {
          return builder;
        },
        update(values: Record<string, unknown>) {
          pendingUpdate = values;
          return builder;
        },
        eq(column: string, value: string) {
          filters[column] = value;
          return builder;
        },
        async maybeSingle() {
          const tableRows = db[table] as unknown as Array<{
            id: string;
            user_id: string;
          }>;
          const matched = applyFilters(tableRows);
          return { data: matched[0] ?? null, error: null };
        },
        async single() {
          const tableRows = db[table] as unknown as Array<
            Record<string, unknown> & { id: string; user_id: string }
          >;
          const matched = applyFilters(tableRows);
          if (matched.length === 0) {
            return {
              data: null,
              error: new Error('RLS violation or row not found'),
            };
          }
          if (pendingUpdate) {
            // Simulasi trigger enforce_owner_user_id: tolak perubahan user_id
            if (
              'user_id' in pendingUpdate &&
              pendingUpdate.user_id !== matched[0].user_id
            ) {
              return {
                data: null,
                error: new Error('Perubahan kepemilikan user_id tidak diizinkan.'),
              };
            }
            Object.assign(matched[0], pendingUpdate, {
              updated_at: '2026-10-26T12:00:00Z',
            });
          }
          return { data: matched[0], error: null };
        },
      };

      return builder;
    },
  };

  return client as unknown as SupabaseClient;
}

describe('Milestone 2: Authentication, Route Guard, CRUD & Cross-User Isolation', () => {
  const USER_A_ID = '11111111-1111-4111-8111-111111111111';
  const USER_B_ID = '22222222-2222-4222-8222-222222222222';

  it('menolak akses ke ProtectedRoute jika pengguna belum login dan mengizinkan jika terautentikasi', () => {
    expect(
      resolveProtectedRouteDecision({ isLoading: true, isAuthenticated: false }),
    ).toBe('loading');
    expect(
      resolveProtectedRouteDecision({ isLoading: false, isAuthenticated: false }),
    ).toBe('redirect-login');
    expect(
      resolveProtectedRouteDecision({ isLoading: false, isAuthenticated: true }),
    ).toBe('allow');
  });

  it('menolak pemanggilan service profil & notifikasi jika sesi tanpa login (userId kosong)', async () => {
    const dummyClient = {} as SupabaseClient;
    await expect(fetchUserProfile('', dummyClient)).rejects.toThrow(
      'Sesi pengguna tidak ditemukan.',
    );
    await expect(
      updateUserProfile(
        '',
        { fullName: 'Anonim', themePreference: 'light' },
        dummyClient,
      ),
    ).rejects.toThrow('Sesi pengguna tidak ditemukan.');
    await expect(fetchNotificationPreferences('', dummyClient)).rejects.toThrow(
      'Sesi pengguna tidak ditemukan.',
    );
  });

  it('menghapus properti kepemilikan (id, user_id, userId) yang disisipkan dari client', () => {
    const maliciousPayload = {
      id: USER_B_ID,
      user_id: USER_B_ID,
      userId: USER_B_ID,
      fullName: 'Nama Baru Valid',
      themePreference: 'dark' as const,
    };

    const sanitized = stripClientOwnershipFields(maliciousPayload);
    expect('id' in sanitized).toBe(false);
    expect('user_id' in sanitized).toBe(false);
    expect('userId' in sanitized).toBe(false);
    expect(sanitized.fullName).toBe('Nama Baru Valid');
  });

  it('menjalankan CRUD dasar profil & notifikasi untuk pemilik sah dan memblokir akses lintas-user (User A vs User B)', async () => {
    const mockDb = {
      profiles: [
        {
          id: USER_A_ID,
          user_id: USER_A_ID,
          full_name: 'Alya Putri',
          avatar_url: null,
          currency_code: 'IDR' as const,
          theme_preference: 'light' as const,
          locale: 'id-ID',
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
        {
          id: USER_B_ID,
          user_id: USER_B_ID,
          full_name: 'Bima Pratama',
          avatar_url: null,
          currency_code: 'IDR' as const,
          theme_preference: 'dark' as const,
          locale: 'id-ID',
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
      ],
      notification_preferences: [
        {
          id: 'pref-a',
          user_id: USER_A_ID,
          budget_alert_enabled: true,
          recurring_reminder_enabled: true,
          debt_reminder_enabled: true,
          weekly_summary_enabled: false,
          reminder_days_before: 3,
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
      ],
    };

    // Klien terautentikasi sebagai User A
    const userAClient = createRlsSimulatingSupabaseClient(USER_A_ID, mockDb);

    // 1. User A membaca profil miliknya sendiri -> Berhasil
    const ownProfile = await fetchUserProfile(USER_A_ID, userAClient);
    expect(ownProfile?.fullName).toBe('Alya Putri');
    expect(ownProfile?.userId).toBe(USER_A_ID);

    // 2. User A mencoba membaca profil User B -> Diblokir oleh RLS (null)
    const otherProfile = await fetchUserProfile(USER_B_ID, userAClient);
    expect(otherProfile).toBeNull();

    // 3. User A mencoba mengubah profil User B -> Ditolak dengan error
    await expect(
      updateUserProfile(
        USER_B_ID,
        { fullName: 'Dibajak oleh A', themePreference: 'light' },
        userAClient,
      ),
    ).rejects.toThrow('Gagal menyimpan perubahan profil pengguna.');

    // Pastikan data User B tetap utuh
    expect(mockDb.profiles[1].full_name).toBe('Bima Pratama');

    // 4. User A memperbarui profil & preferensi notifikasi miliknya sendiri (bahkan jika menyisipkan user_id palsu)
    const updatedOwn = await updateUserProfile(
      USER_A_ID,
      {
        fullName: 'Alya Putri S.',
        themePreference: 'dark',
        user_id: USER_B_ID,
      },
      userAClient,
    );
    expect(updatedOwn.fullName).toBe('Alya Putri S.');
    expect(updatedOwn.themePreference).toBe('dark');
    expect(updatedOwn.userId).toBe(USER_A_ID);

    const updatedPrefs = await updateNotificationPreferences(
      USER_A_ID,
      {
        budgetAlertEnabled: true,
        recurringReminderEnabled: false,
        debtReminderEnabled: true,
        weeklySummaryEnabled: true,
        reminderDaysBefore: 5,
      },
      userAClient,
    );
    expect(updatedPrefs.recurringReminderEnabled).toBe(false);
    expect(updatedPrefs.weeklySummaryEnabled).toBe(true);
    expect(updatedPrefs.reminderDaysBefore).toBe(5);
  });

  it('memvalidasi skema autentikasi Zod dan menerjemahkan pesan error dengan ramah', () => {
    expect(
      loginSchema.safeParse({ email: 'user@finora.id', password: 'password123' })
        .success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({
        fullName: 'Budi',
        email: 'budi@finora.id',
        password: 'password123',
        confirmPassword: 'berbeda123',
      }).success,
    ).toBe(false);
    expect(
      forgotPasswordSchema.safeParse({ email: 'budi@finora.id' }).success,
    ).toBe(true);
    expect(
      profileUpdateSchema.safeParse({
        fullName: 'Budi Santoso',
        themePreference: 'system',
      }).success,
    ).toBe(true);
    expect(
      notificationPreferencesSchema.safeParse({
        budgetAlertEnabled: true,
        recurringReminderEnabled: true,
        debtReminderEnabled: false,
        weeklySummaryEnabled: false,
        reminderDaysBefore: 7,
      }).success,
    ).toBe(true);

    expect(
      mapSupabaseAuthError(new Error('Invalid login credentials')),
    ).toContain('Email atau kata sandi');
  });
});

