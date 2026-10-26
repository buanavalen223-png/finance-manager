import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  fetchNotificationPreferences,
  fetchUserProfile,
  updateNotificationPreferences,
  updateUserProfile,
} from '@/services/profile.service';
import { signOutUser } from '@/services/auth.service';
import { useTheme } from '@/hooks/useTheme';
import type {
  NotificationPreferences,
  Profile,
} from '@/types/domain';
import type {
  NotificationPreferencesFormValues,
  ProfileUpdateFormValues,
} from '@/schemas/auth.schema';

export interface AuthContextValue {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  notificationPreferences: NotificationPreferences | null;
  isPasswordRecovery: boolean;
  refreshUserData: () => Promise<void>;
  saveProfile: (values: ProfileUpdateFormValues) => Promise<Profile>;
  saveNotificationPreferences: (
    values: NotificationPreferencesFormValues,
  ) => Promise<NotificationPreferences>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const { setTheme } = useTheme();

  const [isLoading, setIsLoading] = useState<boolean>(configured);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  const loadUserRecords = useCallback(
    async (activeUserId: string) => {
      if (!supabase) return;
      try {
        const [loadedProfile, loadedPrefs] = await Promise.all([
          fetchUserProfile(activeUserId, supabase),
          fetchNotificationPreferences(activeUserId, supabase),
        ]);

        if (loadedProfile) {
          setProfile(loadedProfile);
          setTheme(loadedProfile.themePreference);
        }
        if (loadedPrefs) {
          setNotificationPreferences(loadedPrefs);
        }
      } catch (err) {
        console.warn('[Finora AI Auth] Gagal memuat profil awal:', err);
      }
    },
    [setTheme],
  );

  useEffect(() => {
    if (!configured || !supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        const currentSession = data.session ?? null;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          void loadUserRecords(currentSession.user.id);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        setProfile(null);
        setNotificationPreferences(null);
      }

      if (nextSession?.user) {
        void loadUserRecords(nextSession.user.id);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configured, loadUserRecords]);

  const refreshUserData = useCallback(async () => {
    if (!user) return;
    await loadUserRecords(user.id);
  }, [user, loadUserRecords]);

  const saveProfile = useCallback(
    async (values: ProfileUpdateFormValues): Promise<Profile> => {
      if (!user) {
        throw new Error('Anda harus masuk terlebih dahulu untuk memperbarui profil.');
      }
      const updated = await updateUserProfile(user.id, values);
      setProfile(updated);
      setTheme(updated.themePreference);
      return updated;
    },
    [user, setTheme],
  );

  const saveNotificationPreferences = useCallback(
    async (
      values: NotificationPreferencesFormValues,
    ): Promise<NotificationPreferences> => {
      if (!user) {
        throw new Error(
          'Anda harus masuk terlebih dahulu untuk memperbarui preferensi notifikasi.',
        );
      }
      const updated = await updateNotificationPreferences(user.id, values);
      setNotificationPreferences(updated);
      return updated;
    },
    [user],
  );

  const signOut = useCallback(async () => {
    await signOutUser();
    setSession(null);
    setUser(null);
    setProfile(null);
    setNotificationPreferences(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: configured,
      isLoading,
      session,
      user,
      profile,
      notificationPreferences,
      isPasswordRecovery,
      refreshUserData,
      saveProfile,
      saveNotificationPreferences,
      signOut,
    }),
    [
      configured,
      isLoading,
      session,
      user,
      profile,
      notificationPreferences,
      isPasswordRecovery,
      refreshUserData,
      saveProfile,
      saveNotificationPreferences,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return context;
}

