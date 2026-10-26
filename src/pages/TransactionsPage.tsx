import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  Wallet as WalletIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { TransactionFormModal } from '@/components/features/transactions/TransactionFormModal';
import { useAuth } from '@/hooks/useAuth';
import { formatIDR } from '@/lib/currency';
import { formatDateID } from '@/lib/date';
import { aggregateTransactionsReport } from '@/lib/finance/ledger';
import { fetchWallets } from '@/services/wallet.service';
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
import type { TransactionFormValues } from '@/schemas/transaction.schema';
import type { CategoryFormValues } from '@/schemas/category.schema';
import type {
  Account,
  Category,
  Transaction,
  TransactionType,
} from '@/types/domain';

type PeriodPreset = 'all' | 'this_month' | 'last_30_days' | 'custom';

const PAGE_SIZE = 10;

function computeDateRangeForPreset(
  preset: PeriodPreset,
  customStart: string,
  customEnd: string,
): { startDate?: string; endDate?: string } {
  const now = new Date();
  if (preset === 'this_month') {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  if (preset === 'last_30_days') {
    const end = now.toISOString().slice(0, 10);
    const startObj = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = startObj.toISOString().slice(0, 10);
    return { startDate: start, endDate: end };
  }
  if (preset === 'custom') {
    return {
      startDate: customStart || undefined,
      endDate: customEnd || undefined,
    };
  }
  return {};
}

export function TransactionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allMatchingTransactions, setAllMatchingTransactions] = useState<
    Transaction[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [accountFilter, setAccountFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // State Modal Tambah / Edit & Konfirmasi Hapus
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalInitialType, setModalInitialType] =
    useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadLedgerData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const dateRange = computeDateRangeForPreset(
        periodPreset,
        customStartDate,
        customEndDate,
      );

      const [loadedWallets, loadedCategories, txResult] = await Promise.all([
        fetchWallets(user.id, { includeArchived: true }),
        ensureDefaultCategories(user.id),
        fetchTransactions(user.id, {
          search: searchQuery,
          type: typeFilter,
          accountId: accountFilter || undefined,
          categoryId: categoryFilter || undefined,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          page: 1,
          pageSize: 200,
        }),
      ]);

      setAccounts(loadedWallets);
      setCategories(loadedCategories);
      setAllMatchingTransactions(txResult.items);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memuat buku besar transaksi.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    user,
    periodPreset,
    customStartDate,
    customEndDate,
    searchQuery,
    typeFilter,
    accountFilter,
    categoryFilter,
  ]);

  useEffect(() => {
    void loadLedgerData();
  }, [loadLedgerData]);

  // Reset halaman ke 1 saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    typeFilter,
    accountFilter,
    categoryFilter,
    periodPreset,
    customStartDate,
    customEndDate,
  ]);

  const periodReport = useMemo(
    () => aggregateTransactionsReport(allMatchingTransactions),
    [allMatchingTransactions],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(allMatchingTransactions.length / PAGE_SIZE),
  );
  const pagedTransactions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allMatchingTransactions.slice(start, start + PAGE_SIZE);
  }, [allMatchingTransactions, page]);

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const activeAccountsCount = useMemo(
    () => accounts.filter((a) => !a.isArchived).length,
    [accounts],
  );

  const openCreateModal = (type: TransactionType) => {
    setModalMode('create');
    setModalInitialType(type);
    setEditingTx(null);
    setModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setModalMode('edit');
    setModalInitialType(tx.type);
    setEditingTx(tx);
    setModalOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setAccountFilter('');
    setCategoryFilter('');
    setPeriodPreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setPage(1);
  };

  const handleQuickCreateCategory = async (
    values: CategoryFormValues,
  ): Promise<Category | null> => {
    if (!user) return null;
    const created = await createCategory(user.id, values);
    setCategories((prev) => [...prev, created]);
    showToast({
      title: 'Kategori Kustom Dibuat',
      description: `Kategori "${created.name}" siap digunakan.`,
      variant: 'success',
    });
    return created;
  };

  const handleSubmitTransaction = async (values: TransactionFormValues) => {
    if (!user) return;
    if (modalMode === 'edit' && editingTx) {
      await updateTransaction(user.id, editingTx.id, values);
      showToast({
        title: 'Transaksi Diperbarui',
        description: `Perubahan transaksi "${values.description}" sebesar ${formatIDR(values.amount)} telah disimpan dan saldo rekening disesuaikan.`,
        variant: 'success',
      });
    } else {
      await createTransaction(user.id, values);
      showToast({
        title: 'Transaksi Tercatat',
        description: `${values.description} sebesar ${formatIDR(values.amount)} berhasil disimpan ke buku besar.`,
        variant: 'success',
      });
    }
    await loadLedgerData();
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingTx || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(user.id, deletingTx.id);
      showToast({
        title: 'Transaksi Dihapus & Saldo Dipulihkan',
        description: `Mutasi "${deletingTx.description}" (${formatIDR(deletingTx.amount)}) telah dihapus dan saldo rekening dikembalikan.`,
        variant: 'info',
      });
      setDeletingTx(null);
      await loadLedgerData();
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
      {/* Header & Aksi Cepat */}
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-5 shadow-subtle lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Buku Besar Transaksi
            </h2>
            <Badge variant="brand">Data Produksi Aktif</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Kelola pemasukan, pengeluaran, dan transfer antar-rekening dengan
            konsistensi saldo atomik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => openCreateModal('income')}
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            + Pemasukan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCreateModal('expense')}
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
            onClick={() => openCreateModal('transfer')}
          >
            <ArrowLeftRight
              className="h-3.5 w-3.5 text-brand"
              aria-hidden="true"
            />
            Transfer Rekening
          </Button>
        </div>
      </section>

      {/* Peringatan jika belum punya rekening aktif */}
      {!isLoading && activeAccountsCount === 0 ? (
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-semantic-warning/40 bg-semantic-warning-soft/50 p-4 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">
              Anda belum memiliki rekening atau dompet aktif
            </p>
            <p className="text-xs text-muted">
              Buat minimal satu rekening (Tunai, Bank, atau E-Wallet) terlebih
              dahulu agar dapat mencatat transaksi.
            </p>
          </div>
          <Link
            to="/dompet"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-brand-foreground"
          >
            <WalletIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Buka Menu Rekening &rarr;
          </Link>
        </div>
      ) : null}

      {/* Ringkasan Agregat Filter Aktif (Transfer Tidak Mencemari Pemasukan/Pengeluaran) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription className="text-xs">
              Total Pemasukan (Filter)
            </CardDescription>
            <CardTitle className="tabular-nums text-xl font-bold text-semantic-income">
              {formatIDR(periodReport.totalIncome, { showSign: true })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted">Diluar transfer internal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription className="text-xs">
              Total Pengeluaran (Filter)
            </CardDescription>
            <CardTitle className="tabular-nums text-xl font-bold text-semantic-expense">
              {formatIDR(periodReport.totalExpense)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted">Diluar transfer internal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription className="text-xs">
              Selisih Arus Kas Bersih
            </CardDescription>
            <CardTitle
              className={`tabular-nums text-xl font-bold ${
                periodReport.netCashflow >= 0
                  ? 'text-foreground'
                  : 'text-semantic-expense'
              }`}
            >
              {formatIDR(periodReport.netCashflow, {
                showSign: periodReport.netCashflow > 0,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted">Pemasukan - Pengeluaran</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription className="text-xs">
              Volume Transfer Antar-Rekening
            </CardDescription>
            <CardTitle className="tabular-nums text-xl font-bold text-foreground">
              {formatIDR(periodReport.totalTransferVolume)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted">
              Mutasi netral antar-dompet
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Panel Pencarian & Filter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-brand" aria-hidden="true" />
              <CardTitle className="text-sm">
                Pencarian &amp; Filter Transaksi
              </CardTitle>
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reset Filter
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Kata Kunci */}
            <div className="relative lg:col-span-2">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari catatan transaksi..."
                aria-label="Cari catatan transaksi"
                className="pl-9 text-xs"
              />
            </div>

            {/* Filter Jenis */}
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as 'all' | TransactionType)
              }
              aria-label="Filter jenis transaksi"
              className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <option value="all">Semua Jenis</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
              <option value="transfer">Transfer</option>
            </select>

            {/* Filter Rekening */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              aria-label="Filter rekening"
              className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <option value="">Semua Rekening</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} {acc.isArchived ? '(Arsip)' : ''}
                </option>
              ))}
            </select>

            {/* Filter Kategori */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter kategori"
              className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <option value="">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.type === 'income' ? 'Masuk' : 'Keluar'})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Periode */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted">
                Periode:
              </span>
              {(
                [
                  { id: 'all', label: 'Semua Waktu' },
                  { id: 'this_month', label: 'Bulan Ini' },
                  { id: 'last_30_days', label: '30 Hari Terakhir' },
                  { id: 'custom', label: 'Rentang Kustom' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPeriodPreset(preset.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    periodPreset === preset.id
                      ? 'bg-brand text-brand-foreground'
                      : 'bg-surface-muted text-muted hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {periodPreset === 'custom' ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  aria-label="Tanggal mulai"
                  className="h-8 w-36 text-xs"
                />
                <span className="text-xs text-muted">s/d</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  aria-label="Tanggal akhir"
                  className="h-8 w-36 text-xs"
                />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Daftar Riwayat Transaksi */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Riwayat Transaksi</CardTitle>
            <CardDescription>
              Menampilkan {pagedTransactions.length} dari{' '}
              {allMatchingTransactions.length} transaksi yang cocok.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openCreateModal('expense')}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Tambah Transaksi
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : errorMsg ? (
            <ErrorState
              title="Gagal Memuat Transaksi"
              message={errorMsg}
              onRetry={() => void loadLedgerData()}
            />
          ) : pagedTransactions.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Tidak Ada Transaksi Ditemukan"
              description="Belum ada transaksi yang tercatat atau sesuai dengan kriteria filter Anda saat ini."
              actionLabel="Catat Transaksi Baru"
              onAction={() => openCreateModal('expense')}
              secondaryActionLabel="Reset Filter"
              onSecondaryAction={handleResetFilters}
            />
          ) : (
            <div className="space-y-4">
              <ul className="divide-y divide-border">
                {pagedTransactions.map((tx) => {
                  const sourceAcc = accountMap.get(tx.accountId);
                  const destAcc = tx.destinationAccountId
                    ? accountMap.get(tx.destinationAccountId)
                    : undefined;
                  const category = tx.categoryId
                    ? categoryMap.get(tx.categoryId)
                    : undefined;

                  return (
                    <li
                      key={tx.id}
                      className="flex flex-col justify-between gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                            tx.type === 'income'
                              ? 'bg-semantic-income-soft text-semantic-income'
                              : tx.type === 'expense'
                                ? 'bg-semantic-expense-soft text-semantic-expense'
                                : 'bg-surface-muted text-foreground'
                          }`}
                        >
                          {tx.type === 'income' ? (
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                          ) : tx.type === 'expense' ? (
                            <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {tx.description}
                            </p>
                            <Badge
                              variant={
                                tx.type === 'income'
                                  ? 'income'
                                  : tx.type === 'expense'
                                    ? 'expense'
                                    : 'default'
                              }
                            >
                              {tx.type === 'income'
                                ? 'Pemasukan'
                                : tx.type === 'expense'
                                  ? 'Pengeluaran'
                                  : 'Transfer'}
                            </Badge>
                          </div>

                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                            <span>
                              {tx.type === 'transfer'
                                ? 'Transfer Antar-Rekening'
                                : (category?.name ?? 'Tanpa Kategori')}
                            </span>
                            <span>&bull;</span>
                            <span className="font-medium text-foreground/80">
                              {tx.type === 'transfer'
                                ? `${sourceAcc?.name ?? 'Rekening'} → ${destAcc?.name ?? 'Tujuan'}`
                                : (sourceAcc?.name ?? 'Rekening')}
                            </span>
                            <span>&bull;</span>
                            <span>{formatDateID(tx.transactionDate)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                        <span
                          className={`tabular-nums text-sm font-bold ${
                            tx.type === 'income'
                              ? 'text-semantic-income'
                              : tx.type === 'expense'
                                ? 'text-semantic-expense'
                                : 'text-foreground'
                          }`}
                        >
                          {tx.type === 'income'
                            ? `+${formatIDR(tx.amount)}`
                            : tx.type === 'expense'
                              ? `-${formatIDR(tx.amount)}`
                              : formatIDR(tx.amount)}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(tx)}
                            aria-label={`Edit transaksi ${tx.description}`}
                            title="Edit transaksi"
                            className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTx(tx)}
                            aria-label={`Hapus transaksi ${tx.description}`}
                            title="Hapus transaksi & kembalikan saldo"
                            className="rounded-md p-1.5 text-muted transition-colors hover:bg-semantic-expense-soft hover:text-semantic-expense"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Pagination Controls */}
              {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
                  <span className="text-muted">
                    Halaman <strong>{page}</strong> dari{' '}
                    <strong>{totalPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Berikutnya
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah / Edit Transaksi */}
      <TransactionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        initialType={modalInitialType}
        initialTransaction={editingTx}
        accounts={accounts}
        categories={categories}
        onSubmitTransaction={handleSubmitTransaction}
        onQuickCreateCategory={handleQuickCreateCategory}
      />

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={Boolean(deletingTx)}
        onClose={() => (isDeleting ? undefined : setDeletingTx(null))}
        onConfirm={() => void handleConfirmDelete()}
        title="Hapus Transaksi & Pulihkan Saldo?"
        description={
          deletingTx
            ? `Anda yakin ingin menghapus transaksi "${deletingTx.description}" sebesar ${formatIDR(deletingTx.amount)}? Saldo rekening terkait akan dikembalikan secara otomatis.`
            : ''
        }
        confirmLabel={isDeleting ? 'Menghapus...' : 'Ya, Hapus Transaksi'}
        variant="danger"
      />
    </div>
  );
}
