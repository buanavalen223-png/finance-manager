import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/hooks/useAuth';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { WalletsPage } from '@/pages/WalletsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { BudgetsPage } from '@/pages/BudgetsPage';
import { SavingsGoalsPage } from '@/pages/SavingsGoalsPage';
import { DebtsPage } from '@/pages/DebtsPage';
import { RecurringBillsPage } from '@/pages/RecurringBillsPage';
import {
  AIAssistantPage,
  ReportsPage,
} from '@/pages/ModulePages';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Rute Publik Autentikasi */}
                <Route path="/auth/masuk" element={<LoginPage />} />
                <Route path="/auth/daftar" element={<RegisterPage />} />
                <Route
                  path="/auth/lupa-sandi"
                  element={<ForgotPasswordPage />}
                />

                {/* Rute Eksplisit Pratinjau UI Design System (Fixture Terisolasi tanpa Akun) */}
                <Route path="/pratinjau-ui" element={<AppShell />}>
                  <Route index element={<DashboardPage />} />
                </Route>

                {/* Rute Privat Terlindungi (Wajib Terautentikasi melalui ProtectedRoute) */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="transaksi" element={<TransactionsPage />} />
                    <Route path="dompet" element={<WalletsPage />} />
                    <Route path="kategori" element={<CategoriesPage />} />
                    <Route path="anggaran" element={<BudgetsPage />} />
                    <Route path="tabungan" element={<SavingsGoalsPage />} />
                    <Route path="utang-piutang" element={<DebtsPage />} />
                    <Route
                      path="tagihan-berulang"
                      element={<RecurringBillsPage />}
                    />
                    <Route path="laporan" element={<ReportsPage />} />
                    <Route path="ai-assistant" element={<AIAssistantPage />} />
                    <Route path="pengaturan" element={<SettingsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
