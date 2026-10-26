import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CalendarClock,
  Clock,
  Pencil,
  Plus,
  Power,
  RotateCw,
  Search,
  Tag,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAuth } from '@/hooks/useAuth';
import { formatIDR, parseIDRInput } from '@/lib/currency';
import { formatDateID, toISODateString } from '@/lib/date';
import { classifyDueStatus } from '@/lib/finance/planning';
import {
  recurringTransactionFormSchema,
  type RecurringTransactionFormValues,
} from '@/schemas/planning.schema';
import { fetchCategories } from '@/services/category.service';
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  executeRecurringTransaction,
  fetchRecurringTransactions,
  toggleRecurringActive,
  updateRecurringTransaction,
} from '@/services/recurring.service';
import { fetchWallets } from '@/services/wallet.service';
import type {
  Account,
  Category,
  RecurringFrequency,
  RecurringTransaction,
} from '@/types/domain';

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
};

export function RecurringBillsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>([]);
  const [wallets, setWallets] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Search
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'due' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Tambah / Edit
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
  const [deletingItem, setDeletingItem] = useState<RecurringTransaction | null>(null);
  const [rawAmount, setRawAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal Eksekusi Transaksi ("Catat Sekarang")
  const [executeModalOpen, setExecuteModalOpen] = useState<boolean>(false);
  const [targetItemToExecute, setTargetItemToExecute] = useState<RecurringTransaction | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [executionDate, setExecutionDate] = useState<string>(toISODateString());
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<RecurringTransactionFormValues>({
    resolver: zodResolver(recurringTransactionFormSchema),
    defaultValues: {
      name: '',
      type: 'expense',
      amount: 100000,
      frequency: 'monthly',
      accountId: '',
      categoryId: '',
      nextDueDate: toISODateString(),
      notes: '',
    },
  });

  const watchType = watch('type');

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [fetchedRecurring, fetchedWallets, fetchedCats] = await Promise.all([
        fetchRecurringTransactions(user.id),
        fetchWallets(user.id),
        fetchCategories(user.id),
      ]);
      setRecurringList(fetchedRecurring);
      setWallets(fetchedWallets.filter((w) => !w.isArchived));
      setCategories(fetchedCats.filter((c) => !c.isArchived));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat daftar tagihan berulang.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ringkasan Statistik
  const summary = useMemo(() => {
    const today = toISODateString();
    let monthlyExpenseEstimate = 0;
    let monthlyIncomeEstimate = 0;
    let dueSoonCount = 0;
    let activeCount = 0;

    for (const item of recurringList) {
      if (!item.isActive) continue;
      activeCount++;

      // Estimasi bulanan
      let multiplier = 1;
      if (item.frequency === 'daily') multiplier = 30;
      else if (item.frequency === 'weekly') multiplier = 4.3;
      else if (item.frequency === 'yearly') multiplier = 1 / 12;

      const monthlyVal = Math.round(item.amount * multiplier);
      if (item.type === 'expense') {
        monthlyExpenseEstimate += monthlyVal;
      } else {
        monthlyIncomeEstimate += monthlyVal;
      }

      const { status } = classifyDueStatus(item.nextDueDate, today);
      if (status === 'overdue' || status === 'due_today') {
        dueSoonCount++;
      }
    }

    return {
      monthlyExpenseEstimate,
      monthlyIncomeEstimate,
      dueSoonCount,
      activeCount,
      totalCount: recurringList.length,
    };
  }, [recurringList]);

  // Filter daftar transaksi berulang
  const filteredList = useMemo(() => {
    const today = toISODateString();
    const query = searchQuery.trim().toLowerCase();

    return recurringList.filter((item) => {
      // Filter Jenis
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      // Filter Status Jatuh Tempo / Aktif
      if (dueFilter === 'active' && !item.isActive) return false;
      if (dueFilter === 'inactive' && item.isActive) return false;
      if (dueFilter === 'due') {
        if (!item.isActive) return false;
        const { status } = classifyDueStatus(item.nextDueDate, today);
        if (status !== 'overdue' && status !== 'due_today' && status !== 'upcoming') {
          return false;
        }
      }

      // Filter Pencarian
      if (query) {
        const matchName = item.name.toLowerCase().includes(query);
        const matchNotes = (item.notes ?? '').toLowerCase().includes(query);
        if (!matchName && !matchNotes) return false;
      }

      return true;
    });
  }, [recurringList, typeFilter, dueFilter, searchQuery]);

  // Handler Buka Modal Buat Jadwal
  const handleOpenCreateModal = (type: 'income' | 'expense' = 'expense') => {
    setModalMode('create');
    setEditingItem(null);
    setRawAmount('100.000');
    reset({
      name: '',
      type,
      amount: 100000,
      frequency: 'monthly',
      accountId: wallets[0]?.id || '',
      categoryId: '',
      nextDueDate: toISODateString(),
      notes: '',
    });
    setModalOpen(true);
  };

  // Handler Buka Modal Edit Jadwal
  const handleOpenEditModal = (item: RecurringTransaction) => {
    setModalMode('edit');
    setEditingItem(item);
    setRawAmount(item.amount.toLocaleString('id-ID'));
    reset({
      name: item.name,
      type: item.type,
      amount: item.amount,
      frequency: item.frequency,
      accountId: item.accountId || '',
      categoryId: item.categoryId || '',
      nextDueDate: item.nextDueDate,
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  // Submit Simpan Jadwal (Tambah / Edit)
  const onSubmit = async (values: RecurringTransactionFormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (modalMode === 'create') {
        await createRecurringTransaction(user.id, values);
        showToast({
          title: 'Jadwal Dibuat',
          description: `Jadwal rutin "${values.name}" berhasil ditambahkan.`,
          variant: 'success',
        });
      } else if (editingItem) {
        await updateRecurringTransaction(user.id, editingItem.id, values);
        showToast({
          title: 'Perubahan Disimpan',
          description: `Jadwal "${values.name}" berhasil diperbarui.`,
          variant: 'success',
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast({
        title: 'Gagal Menyimpan Jadwal',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status Aktif / Nonaktif
  const handleToggleActive = async (item: RecurringTransaction) => {
    if (!user) return;
    try {
      const updated = await toggleRecurringActive(user.id, item.id, !item.isActive);
      showToast({
        title: updated.isActive ? 'Jadwal Diaktifkan' : 'Jadwal Dinonaktifkan',
        description: `Status jadwal "${item.name}" berhasil diubah.`,
        variant: 'info',
      });
      await loadData();
    } catch (err) {
      showToast({
        title: 'Gagal Mengubah Status',
        description: err instanceof Error ? err.message : 'Terjadi kendala sistem.',
        variant: 'error',
      });
    }
  };

  // Buka Modal Eksekusi "Catat Sekarang"
  const handleOpenExecuteModal = (item: RecurringTransaction) => {
    setTargetItemToExecute(item);
    setSelectedWalletId(item.accountId || wallets[0]?.id || '');
    setExecutionDate(toISODateString());
    setExecuteModalOpen(true);
  };

  // Submit Eksekusi Pencatatan
  const handleConfirmExecute = async () => {
    if (!user || !targetItemToExecute) return;
    if (!selectedWalletId) {
      showToast({
        title: 'Pilih Rekening',
        description: 'Tentukan rekening untuk memproses mutasi saldo transaksi ini.',
        variant: 'warning',
      });
      return;
    }

    setIsExecuting(true);
    try {
      await executeRecurringTransaction(
        user.id,
        targetItemToExecute.id,
        executionDate,
        selectedWalletId,
      );

      showToast({
        title: 'Transaksi Dicatat',
        description: `Transaksi "${targetItemToExecute.name}" berhasil dicatat ke buku besar dan tanggal berikutnya telah dimajukan.`,
        variant: 'success',
      });
      setExecuteModalOpen(false);
      await loadData();
    } catch (err) {
      showToast({
        title: 'Gagal Mengeksekusi Tagihan',
        description: err instanceof Error ? err.message : 'Terjadi kendala eksekusi.',
        variant: 'error',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Konfirmasi Hapus Jadwal
  const handleConfirmDelete = async () => {
    if (!user || !deletingItem) return;
    try {
      await deleteRecurringTransaction(user.id, deletingItem.id);
      showToast({
        title: 'Jadwal Dihapus',
        description: 'Jadwal tagihan berulang berhasil dihapus dari sistem.',
        variant: 'success',
      });
      setDeletingItem(null);
      await loadData();
    } catch (err) {
      showToast({
        title: 'Gagal Menghapus',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-finora-charcoal dark:text-finora-warm-white">
            Tagihan & Transaksi Berulang
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Pantau jadwal transaksi rutin, langganan, dan tagihan bulanan agar keuangan tetap terkendali.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenCreateModal('income')}
            className="flex items-center gap-2"
          >
            <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            + Pemasukan Rutin
          </Button>
          <Button
            variant="primary"
            onClick={() => handleOpenCreateModal('expense')}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            + Tagihan Rutin
          </Button>
        </div>
      </div>

      {/* Kartu Ringkasan Keuangan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Estimasi Pengeluaran Bulanan */}
        <Card className="border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Estimasi Beban Bulanan
              </span>
              <div className="rounded-lg bg-red-50 p-2 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
              {formatIDR(summary.monthlyExpenseEstimate)}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Total tagihan rutin aktif per bulan
            </p>
          </CardContent>
        </Card>

        {/* Estimasi Pemasukan Bulanan */}
        <Card className="border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Pemasukan Rutin Bulanan
              </span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
              {formatIDR(summary.monthlyIncomeEstimate)}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Gaji & pendapatan berkala lainnya
            </p>
          </CardContent>
        </Card>

        {/* Tagihan Jatuh Tempo / Terlambat */}
        <Card className="border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Perlu Perhatian Segera
              </span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-400">
              {summary.dueSoonCount} Tagihan
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Jatuh tempo hari ini atau terlewat
            </p>
          </CardContent>
        </Card>

        {/* Jadwal Aktif */}
        <Card className="border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Jadwal Aktif
              </span>
              <div className="rounded-lg bg-stone-100 p-2 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                <CalendarClock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
              {summary.activeCount} / {summary.totalCount}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Pengingat & transaksi otomatis berjalan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tab & Bar Pencarian */}
      <Card className="border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Filter Tab Jenis */}
            <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1 dark:border-stone-800 dark:bg-stone-950">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-white text-finora-charcoal shadow-xs dark:bg-stone-800 dark:text-white'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('expense')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === 'expense'
                    ? 'bg-white text-finora-charcoal shadow-xs dark:bg-stone-800 dark:text-white'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
              >
                Tagihan (Beban)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('income')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === 'income'
                    ? 'bg-white text-finora-charcoal shadow-xs dark:bg-stone-800 dark:text-white'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
              >
                Pemasukan Rutin
              </button>
            </div>

            {/* Filter Status & Search Input */}
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <select
                value={dueFilter}
                onChange={(e) => setDueFilter(e.target.value as 'all' | 'due' | 'active' | 'inactive')}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-finora-charcoal focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              >
                <option value="all">Semua Status</option>
                <option value="due">Jatuh Tempo Terdekat</option>
                <option value="active">Hanya Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>

              <div className="relative min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari nama tagihan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-xs text-finora-charcoal placeholder-stone-400 focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Konten Utama: Daftar Transaksi Berulang */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border border-stone-200 dark:border-stone-800">
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : errorMsg ? (
        <ErrorState
          title="Gagal Memuat Jadwal"
          message={errorMsg}
          onRetry={loadData}
        />
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={
            recurringList.length === 0
              ? 'Belum Ada Tagihan atau Transaksi Rutin'
              : 'Tidak Ada Jadwal yang Cocok'
          }
          description={
            recurringList.length === 0
              ? 'Jadwalkan tagihan listrik, internet, gaji, atau langganan rutin Anda agar dapat dicatat secara tepat waktu.'
              : 'Coba ubah kata kunci pencarian atau sesuaikan filter jenis dan status jadwal.'
          }
          actionLabel={
            recurringList.length === 0 ? '+ Buat Jadwal Pertama' : undefined
          }
          onAction={
            recurringList.length === 0
              ? () => handleOpenCreateModal('expense')
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredList.map((item) => {
            const today = toISODateString();
            const { status: dueStatus, daysDiff } = classifyDueStatus(item.nextDueDate, today);
            const linkedAccount = wallets.find((w) => w.id === item.accountId);
            const linkedCategory = categories.find((c) => c.id === item.categoryId);

            return (
              <Card
                key={item.id}
                className={`flex flex-col justify-between border bg-white transition-all hover:border-stone-300 dark:bg-stone-900 dark:hover:border-stone-700 ${
                  !item.isActive
                    ? 'border-stone-200 opacity-60 dark:border-stone-800'
                    : dueStatus === 'overdue'
                      ? 'border-red-200/80 dark:border-red-950/60'
                      : dueStatus === 'due_today'
                        ? 'border-amber-200/80 dark:border-amber-950/60'
                        : 'border-stone-200/80 dark:border-stone-800'
                }`}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          item.type === 'income'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                        }`}
                      >
                        {item.type === 'income' ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-stone-900 dark:text-stone-100">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            {FREQUENCY_LABELS[item.frequency]}
                          </Badge>
                          {linkedCategory && (
                            <span className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400">
                              <Tag className="h-3 w-3" />
                              {linkedCategory.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex flex-col items-end gap-1">
                      {!item.isActive ? (
                        <Badge variant="default" className="text-stone-400">
                          Nonaktif
                        </Badge>
                      ) : dueStatus === 'overdue' ? (
                        <Badge variant="expense" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Terlambat {Math.abs(daysDiff)} hari
                        </Badge>
                      ) : dueStatus === 'due_today' ? (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Jatuh Tempo Hari Ini
                        </Badge>
                      ) : dueStatus === 'upcoming' ? (
                        <Badge variant="brand" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {daysDiff} hari lagi
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-stone-500">
                          Terjadwal
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-5 pt-0">
                  {/* Nominal & Rekening */}
                  <div className="flex items-baseline justify-between border-b border-stone-100 pb-3 dark:border-stone-800">
                    <div>
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        Nominal Rutin
                      </span>
                      <div
                        className={`text-lg font-bold ${
                          item.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        {formatIDR(item.amount)}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        Rekening Default
                      </span>
                      <div className="flex items-center justify-end gap-1 text-xs font-medium text-stone-700 dark:text-stone-300">
                        <Wallet className="h-3.5 w-3.5 text-stone-400" />
                        {linkedAccount ? linkedAccount.name : 'Belum Ditentukan'}
                      </div>
                    </div>
                  </div>

                  {/* Jadwal Jatuh Tempo & Riwayat Terakhir */}
                  <div className="space-y-1.5 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-600 dark:bg-stone-950/60 dark:text-stone-300">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
                        <Calendar className="h-3.5 w-3.5" />
                        Jatuh Tempo Berikutnya:
                      </span>
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {formatDateID(item.nextDueDate)}
                      </span>
                    </div>
                    {item.lastExecutedDate && (
                      <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                        <span>Pencatatan Terakhir:</span>
                        <span>{formatDateID(item.lastExecutedDate)}</span>
                      </div>
                    )}
                    {item.notes && (
                      <p className="mt-1 line-clamp-2 border-t border-stone-200/60 pt-1 text-stone-500 italic dark:border-stone-800 dark:text-stone-400">
                        "{item.notes}"
                      </p>
                    )}
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(item)}
                        className="h-8 px-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                        title={item.isActive ? 'Nonaktifkan Jadwal' : 'Aktifkan Jadwal'}
                      >
                        <Power
                          className={`h-3.5 w-3.5 ${
                            item.isActive ? 'text-emerald-600' : 'text-stone-400'
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(item)}
                        className="h-8 px-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                        title="Edit Jadwal"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingItem(item)}
                        className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                        title="Hapus Jadwal"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Button
                      variant={dueStatus === 'overdue' || dueStatus === 'due_today' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleOpenExecuteModal(item)}
                      className="h-8 gap-1.5 text-xs font-medium"
                    >
                      <RotateCw className="h-3 w-3" />
                      Catat Sekarang
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: TAMBAH / EDIT JADWAL TRANSAKSI BERULANG         */}
      {/* ======================================================== */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          modalMode === 'create'
            ? 'Tambah Jadwal Transaksi Berulang'
            : 'Perbarui Jadwal Transaksi Berulang'
        }
        description="Jadwal ini akan membantu Anda memantau jatuh tempo dan mencatat transaksi secara idempoten."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Pilihan Jenis Transaksi */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Jenis Transaksi
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setValue('type', 'expense')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                  watchType === 'expense'
                    ? 'border-red-500 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-950/50 dark:text-red-200'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-300'
                }`}
              >
                <ArrowUpRight className="h-4 w-4 text-red-600" />
                Tagihan (Pengeluaran)
              </button>
              <button
                type="button"
                onClick={() => setValue('type', 'income')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                  watchType === 'income'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-300'
                }`}
              >
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                Pemasukan Rutin
              </button>
            </div>
          </div>

          {/* Nama Jadwal */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Nama Transaksi / Tagihan
            </label>
            <Input
              {...register('name')}
              placeholder="Contoh: Tagihan WiFi Indihome, Spotify, Gaji Kantor"
              className="mt-1"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Nominal */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Nominal (Rupiah)
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500">
                Rp
              </span>
              <Input
                type="text"
                value={rawAmount}
                onChange={(e) => {
                  const safe = parseIDRInput(e.target.value);
                  setRawAmount(safe > 0 ? safe.toLocaleString('id-ID') : '');
                  setValue('amount', safe, { shouldValidate: true });
                }}
                placeholder="100.000"
                className="pl-9"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Frekuensi & Tanggal Jatuh Tempo */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Frekuensi Siklus
              </label>
              <select
                {...register('frequency')}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-2 text-xs text-stone-900 focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              >
                <option value="daily">Harian</option>
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Jatuh Tempo Berikutnya
              </label>
              <Input
                type="date"
                {...register('nextDueDate')}
                className="mt-1"
              />
              {errors.nextDueDate && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.nextDueDate.message}
                </p>
              )}
            </div>
          </div>

          {/* Rekening & Kategori Default */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Rekening Default (Opsional)
              </label>
              <select
                {...register('accountId')}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-2 text-xs text-stone-900 focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              >
                <option value="">Pilih rekening nanti...</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatIDR(w.currentBalance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Kategori Transaksi (Opsional)
              </label>
              <select
                {...register('categoryId')}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-2 text-xs text-stone-900 focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              >
                <option value="">Pilih kategori nanti...</option>
                {categories
                  .filter((c) => c.type === watchType)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Catatan / No. Tagihan (Opsional)
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Contoh: No Pelanggan 12345678, auto-debit dari BCA"
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-2.5 text-xs text-stone-900 placeholder-stone-400 focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Jadwal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: KONFIRMASI EKSEKUSI "CATAT SEKARANG"            */}
      {/* ======================================================== */}
      <Modal
        open={executeModalOpen}
        onClose={() => setExecuteModalOpen(false)}
        title="Catat Transaksi Berulang Sekarang"
        description={`Membukukan "${targetItemToExecute?.name || ''}" sebesar ${formatIDR(
          targetItemToExecute?.amount || 0,
        )} ke buku besar transaksi.`}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-950/60 dark:text-stone-300">
            <p>
              Tindakan ini akan membuat baris transaksi riil di buku besar dan secara otomatis memajukan tanggal jatuh tempo berikutnya ke siklus berikutnya ({targetItemToExecute ? FREQUENCY_LABELS[targetItemToExecute.frequency] : ''}).
            </p>
          </div>

          {/* Tanggal Eksekusi */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Tanggal Transaksi
            </label>
            <Input
              type="date"
              value={executionDate}
              onChange={(e) => setExecutionDate(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Pilih Rekening Dompet */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Pilih Rekening Dompet
            </label>
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-2 text-xs text-stone-900 focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            >
              <option value="">Pilih rekening...</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({formatIDR(w.currentBalance)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExecuteModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isExecuting || !selectedWalletId}
              onClick={handleConfirmExecute}
            >
              {isExecuting ? 'Membukukan...' : 'Konfirmasi & Catat'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={Boolean(deletingItem)}
        title="Hapus Jadwal Transaksi Berulang?"
        description={`Jadwal "${deletingItem?.name || ''}" akan dihapus. Riwayat transaksi yang sudah dibukukan sebelumnya tidak akan terpengaruh.`}
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingItem(null)}
      />
    </div>
  );
}

export default RecurringBillsPage;
