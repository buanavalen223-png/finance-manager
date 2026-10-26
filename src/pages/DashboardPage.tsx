import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Database,
  FlaskConical,
  Inbox,
  RotateCcw,
  Wallet as WalletIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { SummaryMetricsGrid } from '@/components/features/dashboard/SummaryMetricsGrid';
import { CashflowChartCard } from '@/components/features/dashboard/CashflowChartCard';
import {
  CategorySpendingCard,
  type CategorySpendItem,
} from '@/components/features/dashboard/CategorySpendingCard';
import { RecentTransactionsCard } from '@/components/features/dashboard/RecentTransactionsCard';
import { BudgetSummaryCard } from '@/components/features/dashboard/BudgetSummaryCard';
import { UpcomingBillsCard } from '@/components/features/dashboard/UpcomingBillsCard';
import { AIInsightCard } from '@/components/features/dashboard/AIInsightCard';
import { QuickActionModal } from '@/components/features/dashboard/QuickActionModal';
import { TransactionFormModal } from '@/components/features/transactions/TransactionFormModal';
import { WalletFormModal } from '@/components/features/wallets/WalletFormModal';
import { useAuth } from '@/hooks/useAuth';
import { addMoney, formatIDR, subtractMoney } from '@/lib/currency';
import { getCurrentMonthPeriod } from '@/lib/date';
import {
  aggregateCategoryExpenseBreakdown,
  aggregateTransactionsReport,
  buildMonthlyCashflowSeries,
  computeTotalActiveBalance,
} from '@/lib/finance/ledger';
import { getUpcomingBills } from '@/lib/finance/planning';
import { createWallet, fetchWallets } from '@/services/wallet.service';
import {
  createCategory,
  ensureDefaultCategories,
} from '@/services/category.service';
import {
  createTransaction,
  deleteTransaction,
  fetchTransactions,
  updateTransaction,
} from '@/services/transaction.service';
import { fetchBudgets } from '@/services/budget.service';
import { fetchRecurringTransactions } from '@/services/recurring.service';
import { fetchDebts } from '@/services/debt.service';
import {
  DEMO_DATASET_METADATA,
  INITIAL_DEMO_AI_INSIGHTS,
  INITIAL_DEMO_BUDGETS,
  INITIAL_DEMO_CASHFLOW_SERIES,
  INITIAL_DEMO_CATEGORIES,
  INITIAL_DEMO_TRANSACTIONS,
  INITIAL_DEMO_WALLETS,
  type DemoAIInsight,
  type DemoCategory,
  type DemoTransaction,
  type DemoWallet,
} from '@/fixtures/dashboardDemoData';
import type { TransactionFormValues } from '@/schemas/transaction.schema';
import type { CategoryFormValues } from '@/schemas/category.schema';
import type { WalletFormValues } from '@/schemas/wallet.schema';
import type {
  Account,
  Budget,
  Category,
  DebtRecord,
  RecurringTransaction,
  Transaction,
  TransactionType,
} from '@/types/domain';

type DashboardViewMode = 'ready' | 'loading' | 'empty' | 'error';

/**
 * Dashboard Produksi yang terhubung ke database Supabase (Accounts, Categories, Transactions).
 */
function ProductionDashboardView() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const currentPeriod = useMemo(() => getCurrentMonthPeriod(), []);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Transaksi & Rekening
  const [txModalOpen, setTxModalOpen] = useState<boolean>(false);
  const [txModalMode, setTxModalMode] = useState<'create' | 'edit'>('create');
  const [txModalType, setTxModalType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);

  const loadProductionDashboard = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [
        loadedWallets,
        loadedCategories,
        txRes,
        loadedBudgets,
        loadedRecurring,
        loadedDebts,
      ] = await Promise.all([
        fetchWallets(user.id, { includeArchived: false }),
        ensureDefaultCategories(user.id),
        fetchTransactions(user.id, { page: 1, pageSize: 200 }),
        fetchBudgets(user.id, currentPeriod.month, currentPeriod.year),
        fetchRecurringTransactions(user.id, { isActiveOnly: true }),
        fetchDebts(user.id),
      ]);

      setAccounts(loadedWallets);
      setCategories(loadedCategories);
      setTransactions(txRes.items);
      setBudgets(loadedBudgets);
      setRecurring(loadedRecurring);
      setDebts(loadedDebts);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memuat data dashboard dari Supabase.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, currentPeriod.month, currentPeriod.year]);

  useEffect(() => {
    void loadProductionDashboard();
  }, [loadProductionDashboard]);

  // Transaksi bulan berjalan untuk metrik bulanan
  const currentYearMonth = useMemo(() => {
    const m = String(currentPeriod.month).padStart(2, '0');
    return `${currentPeriod.year}-${m}`;
  }, [currentPeriod]);

  const currentMonthTransactions = useMemo(
    () =>
      transactions.filter((tx) =>
        tx.transactionDate.startsWith(currentYearMonth),
      ),
    [transactions, currentYearMonth],
  );

  const totalBalance = useMemo(
    () => computeTotalActiveBalance(accounts),
    [accounts],
  );

  const monthlySummary = useMemo(
    () => aggregateTransactionsReport(currentMonthTransactions),
    [currentMonthTransactions],
  );

  const categorySpending = useMemo<CategorySpendItem[]>(
    () =>
      aggregateCategoryExpenseBreakdown(currentMonthTransactions, categories),
    [currentMonthTransactions, categories],
  );

  const cashflowSeries = useMemo(
    () => buildMonthlyCashflowSeries(transactions, 6),
    [transactions],
  );

  // Pemetaan ke bentuk prop kartu UI yang sudah ada
  const uiWallets = useMemo<DemoWallet[]>(
    () =>
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.currentBalance,
      })),
    [accounts],
  );

  const uiCategories = useMemo<DemoCategory[]>(
    () =>
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        color: c.color,
      })),
    [categories],
  );

  const uiTransactions = useMemo<DemoTransaction[]>(
    () =>
      transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        walletId: tx.accountId,
        destinationWalletId: tx.destinationAccountId ?? undefined,
        categoryId: tx.categoryId ?? undefined,
        description: tx.description,
        transactionDate: tx.transactionDate,
      })),
    [transactions],
  );

  const upcomingBills = useMemo(
    () => getUpcomingBills(recurring, debts),
    [recurring, debts],
  );

  // Insight dinamis dari data nyata pengguna
  const dynamicInsights = useMemo<DemoAIInsight[]>(() => {
    const topCategory = categorySpending[0];
    return [
      {
        id: 'live-ins-1',
        title:
          monthlySummary.netCashflow >= 0
            ? 'Arus Kas Bersih Bulan Ini Positif'
            : 'Perhatian: Defisit Arus Kas Bulan Ini',
        summary:
          monthlySummary.netCashflow >= 0
            ? `Surplus kas bulan ${currentPeriod.label} mencapai ${formatIDR(monthlySummary.netCashflow)}. Mutasi transfer internal sebesar ${formatIDR(monthlySummary.totalTransferVolume)} tidak dihitung sebagai pengeluaran.`
            : `Pengeluaran bulan ${currentPeriod.label} melebihi pemasukan sebesar ${formatIDR(Math.abs(monthlySummary.netCashflow))}. Tinjau pos pengeluaran terbesar Anda.`,
        tag: 'Rasio Tabungan',
        tone: monthlySummary.netCashflow >= 0 ? 'positive' : 'warning',
      },
      {
        id: 'live-ins-2',
        title: topCategory
          ? `Pos Terbesar: ${topCategory.name}`
          : 'Belum Ada Pengeluaran Bulan Ini',
        summary: topCategory
          ? `Kategori "${topCategory.name}" menyerap ${formatIDR(topCategory.amount)} pada periode ${currentPeriod.label}.`
          : 'Catat transaksi harian Anda untuk melihat analisis komposisi pengeluaran secara otomatis.',
        tag: 'Optimasi Kas',
        tone: 'neutral',
      },
    ];
  }, [monthlySummary, categorySpending, currentPeriod.label]);

  const openQuickAction = (type: TransactionType) => {
    if (accounts.length === 0) {
      setWalletModalOpen(true);
      return;
    }
    setTxModalMode('create');
    setTxModalType(type);
    setEditingTx(null);
    setTxModalOpen(true);
  };

  const handleRequestEditFromCard = (demoTx: DemoTransaction) => {
    const found = transactions.find((t) => t.id === demoTx.id);
    if (!found) return;
    setTxModalMode('edit');
    setTxModalType(found.type);
    setEditingTx(found);
    setTxModalOpen(true);
  };

  const handleRequestDeleteFromCard = (demoTx: DemoTransaction) => {
    const found = transactions.find((t) => t.id === demoTx.id);
    if (found) {
      setDeletingTx(found);
    }
  };

  const handleSubmitTransaction = async (values: TransactionFormValues) => {
    if (!user) return;
    if (txModalMode === 'edit' && editingTx) {
      await updateTransaction(user.id, editingTx.id, values);
      showToast({
        title: 'Transaksi Diperbarui',
        description: `Perubahan "${values.description}" (${formatIDR(values.amount)}) disimpan dan saldo disesuaikan.`,
        variant: 'success',
      });
    } else {
      await createTransaction(user.id, values);
      showToast({
        title: 'Transaksi Tersimpan',
        description: `${values.description} sebesar ${formatIDR(values.amount)} berhasil dicatat dan saldo rekening diperbarui.`,
        variant: 'success',
      });
    }
    await loadProductionDashboard();
  };

  const handleQuickCreateCategory = async (
    values: CategoryFormValues,
  ): Promise<Category | null> => {
    if (!user) return null;
    const created = await createCategory(user.id, values);
    setCategories((prev) => [...prev, created]);
    return created;
  };

  const handleCreateFirstWallet = async (values: WalletFormValues) => {
    if (!user) return;
    const created = await createWallet(user.id, values);
    showToast({
      title: 'Rekening Berhasil Dibuat',
      description: `Rekening "${created.name}" dengan saldo awal ${formatIDR(created.initialBalance)} siap digunakan.`,
      variant: 'success',
    });
    await loadProductionDashboard();
  };

  const handleConfirmDeleteTransaction = async () => {
    if (!user || !deletingTx || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(user.id, deletingTx.id);
      showToast({
        title: 'Transaksi Dihapus & Saldo Dipulihkan',
        description: `Mutasi "${deletingTx.description}" (${formatIDR(deletingTx.amount)}) telah dibatalkan.`,
        variant: 'info',
      });
      setDeletingTx(null);
      await loadProductionDashboard();
    } catch (err) {
      showToast({
        title: 'Gagal Menghapus Transaksi',
        description:
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat menghapus transaksi.',
        variant: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar Atas: Status Buku Besar Supabase & Quick Actions */}
      <section
        aria-label="Aksi cepat buku besar"
        className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-4 shadow-subtle lg:flex-row lg:items-center"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">
              <Database className="mr-1 h-3 w-3" aria-hidden="true" />
              BUKU BESAR PRODUKSI
            </Badge>
            <span className="text-xs font-medium text-muted">
              Periode Aktif: {currentPeriod.label}
            </span>
          </div>
          <p className="text-xs text-muted">
            Seluruh saldo rekening, pemasukan, pengeluaran, dan transfer
            dihitung secara real-time dari database Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => openQuickAction('income')}
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            + Pemasukan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openQuickAction('expense')}
          >
            <ArrowDownRight
              className="h-3.5 w-3.5 text-semantic-expense"
              aria-hidden="true"
            />
            - Pengeluaran
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openQuickAction('transfer')}
          >
            <ArrowLeftRight
              className="h-3.5 w-3.5 text-brand"
              aria-hidden="true"
            />
            Transfer
          </Button>
        </div>
      </section>

      {isLoading ? (
        <DashboardSkeleton />
      ) : errorMsg ? (
        <ErrorState
          title="Gagal Memuat Buku Besar"
          code="SUPABASE_LEDGER_ERROR"
          message={errorMsg}
          onRetry={() => void loadProductionDashboard()}
        />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title="Mulai dengan Menambahkan Rekening Pertama Anda"
          description="Anda belum memiliki rekening/dompet aktif. Buat rekening bank, e-wallet, atau kas tunai beserta saldo awalnya untuk mulai mencatat transaksi."
          actionLabel="Buat Rekening Pertama"
          onAction={() => setWalletModalOpen(true)}
        />
      ) : (
        <>
          {/* 1. Kartu Metrik Utama */}
          <SummaryMetricsGrid
            totalBalance={totalBalance}
            monthlyIncome={monthlySummary.totalIncome}
            monthlyExpense={monthlySummary.totalExpense}
            netCashflow={monthlySummary.netCashflow}
            wallets={uiWallets}
          />

          {/* 2. Area Insight AI */}
          <AIInsightCard
            insights={dynamicInsights}
            onSimulateAIDraft={() => openQuickAction('expense')}
          />

          {/* 3. Grafik Arus Kas & Komposisi Pengeluaran */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CashflowChartCard data={cashflowSeries} isDemo={false} />
            </div>
            <div className="lg:col-span-5">
              <CategorySpendingCard
                items={categorySpending}
                totalExpense={monthlySummary.totalExpense}
                onAddExpense={() => openQuickAction('expense')}
                isDemo={false}
              />
            </div>
          </div>

          {/* 4. Daftar Transaksi Terbaru & Ringkasan Anggaran */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <RecentTransactionsCard
                transactions={uiTransactions}
                wallets={uiWallets}
                categories={uiCategories}
                onRequestDelete={handleRequestDeleteFromCard}
                onRequestEdit={handleRequestEditFromCard}
                onRequestCreate={(type) => openQuickAction(type)}
                isDemo={false}
              />
            </div>
            <div className="space-y-6 lg:col-span-5">
              <BudgetSummaryCard
                budgets={budgets}
                categories={uiCategories}
                transactions={uiTransactions}
                isDemo={false}
              />
              <UpcomingBillsCard items={upcomingBills} isDemo={false} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">
            <span>
              Ingin mencari transaksi lama, memfilter rentang tanggal, atau
              mengelola arsip rekening?
            </span>
            <div className="flex items-center gap-3 font-medium text-brand">
              <Link to="/transaksi" className="hover:underline">
                Buka Halaman Transaksi &rarr;
              </Link>
              <Link to="/dompet" className="hover:underline">
                Kelola Rekening &rarr;
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Modal Tambah / Edit Transaksi Produksi */}
      <TransactionFormModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        mode={txModalMode}
        initialType={txModalType}
        initialTransaction={editingTx}
        accounts={accounts}
        categories={categories}
        onSubmitTransaction={handleSubmitTransaction}
        onQuickCreateCategory={handleQuickCreateCategory}
      />

      {/* Modal Tambah Rekening Pertama */}
      <WalletFormModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        mode="create"
        onSubmitWallet={handleCreateFirstWallet}
      />

      {/* Dialog Konfirmasi Hapus Transaksi */}
      <ConfirmDialog
        open={Boolean(deletingTx)}
        onClose={() => (isDeleting ? undefined : setDeletingTx(null))}
        onConfirm={() => void handleConfirmDeleteTransaction()}
        title="Hapus Transaksi & Pulihkan Saldo?"
        description={
          deletingTx
            ? `Anda akan menghapus transaksi "${deletingTx.description}" sebesar ${formatIDR(deletingTx.amount)}. Saldo rekening terkait akan dikembalikan secara otomatis.`
            : ''
        }
        confirmLabel={isDeleting ? 'Menghapus...' : 'Ya, Hapus Transaksi'}
        variant="danger"
      />
    </div>
  );
}

/**
 * Dashboard Pratinjau UI Terisolasi (`/pratinjau-ui`) untuk menguji Design System tanpa akun.
 */
function IsolatedDemoDashboardView() {
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<DashboardViewMode>('ready');
  const [wallets, setWallets] = useState<DemoWallet[]>(INITIAL_DEMO_WALLETS);
  const [transactions, setTransactions] = useState<DemoTransaction[]>(
    INITIAL_DEMO_TRANSACTIONS,
  );

  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [quickModalType, setQuickModalType] =
    useState<TransactionType>('expense');
  const [aiDraftPrefill, setAiDraftPrefill] = useState<{
    type: TransactionType;
    amount: number;
    walletId: string;
    categoryId?: string;
    description: string;
  } | null>(null);

  const [txToDelete, setTxToDelete] = useState<DemoTransaction | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const totalBalance = useMemo(
    () => wallets.reduce((acc, w) => addMoney(acc, w.balance), 0),
    [wallets],
  );

  const monthlyIncome = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'income')
        .reduce((acc, tx) => addMoney(acc, tx.amount), 0),
    [transactions],
  );

  const monthlyExpense = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'expense')
        .reduce((acc, tx) => addMoney(acc, tx.amount), 0),
    [transactions],
  );

  const netCashflow = useMemo(
    () => subtractMoney(monthlyIncome, monthlyExpense),
    [monthlyIncome, monthlyExpense],
  );

  const categorySpending = useMemo<CategorySpendItem[]>(() => {
    const expenseCategories = INITIAL_DEMO_CATEGORIES.filter(
      (c) => c.type === 'expense',
    );
    return expenseCategories
      .map((cat) => {
        const sum = transactions
          .filter((tx) => tx.type === 'expense' && tx.categoryId === cat.id)
          .reduce((acc, tx) => addMoney(acc, tx.amount), 0);
        return {
          categoryId: cat.id,
          name: cat.name,
          amount: sum,
          color: cat.color,
        };
      })
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const cashflowSeries = useMemo(() => {
    return INITIAL_DEMO_CASHFLOW_SERIES.map((point, index, arr) =>
      index === arr.length - 1
        ? { ...point, income: monthlyIncome, expense: monthlyExpense }
        : point,
    );
  }, [monthlyIncome, monthlyExpense]);

  const openQuickAction = (type: TransactionType) => {
    setAiDraftPrefill(null);
    setQuickModalType(type);
    setQuickModalOpen(true);
  };

  const handleOpenAIDraftPreview = () => {
    setAiDraftPrefill({
      type: 'expense',
      amount: 145000,
      walletId: 'wallet-gopay',
      categoryId: 'cat-food',
      description: 'Makan Siang Tim & Kopi (Draf AI)',
    });
    setQuickModalType('expense');
    setQuickModalOpen(true);
  };

  const handleCreateTransaction = (newTxInput: Omit<DemoTransaction, 'id'>) => {
    const newTx: DemoTransaction = {
      ...newTxInput,
      id: `tx-demo-${Date.now()}`,
    };

    setWallets((prevWallets) =>
      prevWallets.map((wallet) => {
        if (newTx.type === 'income' && wallet.id === newTx.walletId) {
          return { ...wallet, balance: addMoney(wallet.balance, newTx.amount) };
        }
        if (newTx.type === 'expense' && wallet.id === newTx.walletId) {
          return {
            ...wallet,
            balance: subtractMoney(wallet.balance, newTx.amount),
          };
        }
        if (newTx.type === 'transfer') {
          if (wallet.id === newTx.walletId) {
            return {
              ...wallet,
              balance: subtractMoney(wallet.balance, newTx.amount),
            };
          }
          if (wallet.id === newTx.destinationWalletId) {
            return {
              ...wallet,
              balance: addMoney(wallet.balance, newTx.amount),
            };
          }
        }
        return wallet;
      }),
    );

    setTransactions((prev) => [newTx, ...prev]);
    if (viewMode === 'empty') {
      setViewMode('ready');
    }

    showToast({
      title: 'Transaksi Demo Tersimpan',
      description: `${newTx.description} sebesar ${formatIDR(newTx.amount)} berhasil dicatat dan saldo diperbarui.`,
      variant: 'success',
    });
  };

  const handleConfirmDeleteTransaction = () => {
    if (!txToDelete) return;

    setWallets((prevWallets) =>
      prevWallets.map((wallet) => {
        if (txToDelete.type === 'income' && wallet.id === txToDelete.walletId) {
          return {
            ...wallet,
            balance: subtractMoney(wallet.balance, txToDelete.amount),
          };
        }
        if (
          txToDelete.type === 'expense' &&
          wallet.id === txToDelete.walletId
        ) {
          return {
            ...wallet,
            balance: addMoney(wallet.balance, txToDelete.amount),
          };
        }
        if (txToDelete.type === 'transfer') {
          if (wallet.id === txToDelete.walletId) {
            return {
              ...wallet,
              balance: addMoney(wallet.balance, txToDelete.amount),
            };
          }
          if (wallet.id === txToDelete.destinationWalletId) {
            return {
              ...wallet,
              balance: subtractMoney(wallet.balance, txToDelete.amount),
            };
          }
        }
        return wallet;
      }),
    );

    setTransactions((prev) => prev.filter((item) => item.id !== txToDelete.id));

    showToast({
      title: 'Transaksi Dihapus & Saldo Dipulihkan',
      description: `Mutasi "${txToDelete.description}" (${formatIDR(txToDelete.amount)}) telah dibatalkan.`,
      variant: 'info',
    });
    setTxToDelete(null);
  };

  const handleConfirmResetDemo = () => {
    setWallets(INITIAL_DEMO_WALLETS);
    setTransactions(INITIAL_DEMO_TRANSACTIONS);
    setViewMode('ready');
    showToast({
      title: 'Data Demo Direset',
      description:
        'Seluruh saldo rekening dan riwayat transaksi demo telah dikembalikan ke kondisi awal.',
      variant: 'info',
    });
  };

  return (
    <div className="space-y-6">
      <section
        aria-label="Aksi cepat dan kontrol tampilan demo"
        className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-4 shadow-subtle lg:flex-row lg:items-center"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">
              <FlaskConical className="mr-1 h-3 w-3" aria-hidden="true" />
              {DEMO_DATASET_METADATA.badgeText}
            </Badge>
            <span className="text-xs font-medium text-muted">
              Periode Simulasi: {DEMO_DATASET_METADATA.periodLabel}
            </span>
          </div>
          <p className="text-xs text-muted">{DEMO_DATASET_METADATA.notice}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => openQuickAction('income')}
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            + Pemasukan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openQuickAction('expense')}
          >
            <ArrowDownRight
              className="h-3.5 w-3.5 text-semantic-expense"
              aria-hidden="true"
            />
            - Pengeluaran
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openQuickAction('transfer')}
          >
            <ArrowLeftRight
              className="h-3.5 w-3.5 text-brand"
              aria-hidden="true"
            />
            Transfer
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-medium text-muted">Pratinjau State UI:</span>
          {(
            [
              { id: 'ready', label: 'Data Demo' },
              { id: 'loading', label: 'Skeleton Loading' },
              { id: 'empty', label: 'Empty State' },
              { id: 'error', label: 'Error State' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id)}
              aria-pressed={viewMode === mode.id}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                viewMode === mode.id
                  ? 'bg-brand-soft text-brand-soft-foreground'
                  : 'bg-surface text-muted hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setConfirmResetOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset Data Demo
        </button>
      </div>

      {viewMode === 'loading' ? (
        <DashboardSkeleton />
      ) : viewMode === 'error' ? (
        <ErrorState
          title="Simulasi Gangguan Sinkronisasi Buku Besar"
          code="DEMO_SYNC_TIMEOUT"
          message="Ini adalah pratinjau komponen Error State Finora AI ketika koneksi jaringan terputus. Klik tombol di kanan untuk kembali ke tampilan Dashboard."
          onRetry={() => {
            setViewMode('ready');
            showToast({
              title: 'Tampilan Dipulihkan',
              description: 'Dashboard kembali menampilkan data demo.',
              variant: 'success',
            });
          }}
        />
      ) : viewMode === 'empty' || transactions.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Buku Besar Anda Masih Kosong"
          description="Belum ada pemasukan, pengeluaran, maupun transfer yang tercatat pada periode ini. Mulai catat transaksi pertama Anda atau kembalikan data demo."
          actionLabel="Tambah Transaksi Pertama"
          onAction={() => openQuickAction('income')}
          secondaryActionLabel="Muat Ulang Data Demo"
          onSecondaryAction={handleConfirmResetDemo}
        />
      ) : (
        <>
          <SummaryMetricsGrid
            totalBalance={totalBalance}
            monthlyIncome={monthlyIncome}
            monthlyExpense={monthlyExpense}
            netCashflow={netCashflow}
            wallets={wallets}
          />

          <AIInsightCard
            insights={INITIAL_DEMO_AI_INSIGHTS}
            onSimulateAIDraft={handleOpenAIDraftPreview}
          />

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CashflowChartCard data={cashflowSeries} isDemo={true} />
            </div>
            <div className="lg:col-span-5">
              <CategorySpendingCard
                items={categorySpending}
                totalExpense={monthlyExpense}
                onAddExpense={() => openQuickAction('expense')}
                isDemo={true}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <RecentTransactionsCard
                transactions={transactions}
                wallets={wallets}
                categories={INITIAL_DEMO_CATEGORIES}
                onRequestDelete={(tx) => setTxToDelete(tx)}
                onRequestCreate={(type) => openQuickAction(type)}
                isDemo={true}
              />
            </div>
            <div className="lg:col-span-5">
              <BudgetSummaryCard
                budgets={INITIAL_DEMO_BUDGETS}
                categories={INITIAL_DEMO_CATEGORIES}
                transactions={transactions}
                isDemo={true}
              />
            </div>
          </div>
        </>
      )}

      <QuickActionModal
        open={quickModalOpen}
        onClose={() => setQuickModalOpen(false)}
        initialType={quickModalType}
        prefillDraft={aiDraftPrefill}
        wallets={wallets}
        categories={INITIAL_DEMO_CATEGORIES}
        onSubmitTransaction={handleCreateTransaction}
      />

      <ConfirmDialog
        open={Boolean(txToDelete)}
        onClose={() => setTxToDelete(null)}
        onConfirm={handleConfirmDeleteTransaction}
        title="Hapus Transaksi & Pulihkan Saldo?"
        description={
          txToDelete
            ? `Anda akan menghapus transaksi "${txToDelete.description}" sebesar ${formatIDR(txToDelete.amount)}. Saldo rekening terkait akan dikembalikan secara otomatis.`
            : ''
        }
        confirmLabel="Ya, Hapus Transaksi"
        variant="danger"
      />

      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleConfirmResetDemo}
        title="Reset Data Demo ke Kondisi Awal?"
        description="Seluruh transaksi baru atau penghapusan yang Anda lakukan pada sesi pratinjau ini akan dikembalikan ke kumpulan data fixture awal."
        confirmLabel="Reset Data Demo"
        variant="primary"
      />
    </div>
  );
}

export function DashboardPage() {
  const location = useLocation();
  const { user } = useAuth();

  // Rute eksplisit /pratinjau-ui menampilkan demo terisolasi; rute utama '/' menggunakan data Supabase
  if (location.pathname.startsWith('/pratinjau-ui') || !user) {
    return <IsolatedDemoDashboardView />;
  }

  return <ProductionDashboardView />;
}
