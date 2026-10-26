-- ============================================================================
-- FINORA AI — SEED SCRIPT (SAFE / NO DEMO USER INJECTION)
-- ============================================================================
-- Catatan Keamanan:
-- - Sesuai aturan proyek, kita TIDAK membuat akun demo publik yang dapat
--   mengakses data pengguna lain.
-- - Kategori bawaan (default categories), profil, dan notification_preferences
--   dibuat secara otomatis per pengguna baru melalui trigger
--   `public.handle_new_user_onboarding()` pada `0003_triggers_and_onboarding.sql`.
-- ============================================================================

SELECT 'Finora AI schema ready. Default user categories are seeded automatically per user upon signup.' AS status;

