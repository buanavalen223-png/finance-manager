import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  HandCoins,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
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
import { resolveDebtStatus, type DebtDisplayStatus } from '@/lib/finance/planning';
import {
  debtFormSchema,
  debtPaymentFormSchema,
  type DebtFormValues,
  type DebtPaymentFormValues,
} from '@/schemas/planning.schema';
import {
  createDebt,
  deleteDebt,
  fetchDebtPayments,
  fetchDebts,
  recordDebtPayment,
  updateDebt,
} from '@/services/debt.service';
import { fetchWallets } from '@/services/wallet.service';
import type { Account, DebtPayment, DebtRecord, DebtType } from '@/types/domain';

export function DebtsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [wallets, setWallets] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Pencarian
  const [typeFilter, setTypeFilter] = useState<'all' | DebtType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DebtDisplayStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Tambah / Edit Utang
  const [debtModalOpen, setDebtModalOpen] = useState<boolean>(false);
  const [debtModalMode, setDebtModalMode] = useState<'create' | 'edit'>('create');
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [deletingDebt, setDeletingDebt] = useState<DebtRecord | null>(null);
  const [rawPrincipalAmount, setRawPrincipalAmount] = useState<string>('');
  const [isSubmittingDebt, setIsSubmittingDebt] = useState<boolean>(false);

  // Modal Catat Pembayaran
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [targetDebtForPayment, setTargetDebtForPayment] = useState<DebtRecord | null>(null);
  const [rawPaymentAmount, setRawPaymentAmount] = useState<string>('');
  const [linkToWallet, setLinkToWallet] = useState<boolean>(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Modal Riwayat Pembayaran
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [viewingDebtHistory, setViewingDebtHistory] = useState<DebtRecord | null>(null);
  const [debtPaymentsList, setDebtPaymentsList] = useState<DebtPayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);

  const {
    register: registerDebt,
    handleSubmit: handleSubmitDebt,
    setValue: setDebtValue,
    reset: resetDebtForm,
    formState: { errors: debtErrors },
  } = useForm<DebtFormValues>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: {
      type: 'payable',
      counterpartyName: '',
      principalAmount: 500000,
      dueDate: '',
      notes: '',
    },
  });

  const {
    register: registerPayment,
    handleSubmit: handleSubmitPayment,
    setValue: setPaymentValue,
    reset: resetPaymentForm,
    formState: { errors: paymentErrors },
  } = useForm<DebtPaymentFormValues>({
    resolver: zodResolver(debtPaymentFormSchema),
    defaultValues: {
      amount: 100000,
      paymentDate: toISODateString(),
      notes: '',
      accountId: '',
    },
  });

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [fetchedDebts, fetchedWallets] = await Promise.all([
        fetchDebts(user.id),
        fetchWallets(user.id),
      ]);
      setDebts(fetchedDebts);
      setWallets(fetchedWallets.filter((w) => !w.isArchived));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat data utang dan piutang.',
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
    let totalPayableRemaining = 0;
    let totalReceivableRemaining = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let paidCount = 0;

    for (const debt of debts) {
      const status = resolveDebtStatus(debt, today);
      if (status === 'paid') {
        paidCount++;
        continue;
      }

      if (debt.type === 'payable') {
        totalPayableRemaining += debt.remainingAmount;
      } else {
        totalReceivableRemaining += debt.remainingAmount;
      }

      if (status === 'overdue') {
        overdueCount++;
        overdueAmount += debt.remainingAmount;
      }
    }

    return {
      totalPayableRemaining,
      totalReceivableRemaining,
      overdueCount,
      overdueAmount,
      paidCount,
      totalCount: debts.length,
    };
  }, [debts]);

  // Filter daftar catatan
  const filteredDebts = useMemo(() => {
    const today = toISODateString();
    const query = searchQuery.trim().toLowerCase();

    return debts.filter((debt) => {
      // Filter Jenis
      if (typeFilter !== 'all' && debt.type !== typeFilter) {
        return false;
      }

      // Filter Status
      const displayStatus = resolveDebtStatus(debt, today);
      if (statusFilter !== 'all') {
        if (statusFilter === 'unpaid' && (displayStatus === 'paid' || displayStatus === 'overdue')) {
          return false;
        }
        if (statusFilter !== 'unpaid' && displayStatus !== statusFilter) {
          return false;
        }
      }

      // Filter Pencarian
      if (query) {
        const matchName = debt.counterpartyName.toLowerCase().includes(query);
        const matchNotes = (debt.notes ?? '').toLowerCase().includes(query);
        if (!matchName && !matchNotes) return false;
      }

      return true;
    });
  }, [debts, typeFilter, statusFilter, searchQuery]);

  // Handler Buka Modal Tambah Catatan
  const handleOpenCreateModal = (type: DebtType = 'payable') => {
    setDebtModalMode('create');
    setEditingDebt(null);
    setRawPrincipalAmount('500.000');
    resetDebtForm({
      type,
      counterpartyName: '',
      principalAmount: 500000,
      dueDate: '',
      notes: '',
    });
    setDebtModalOpen(true);
  };

  // Handler Buka Modal Edit Catatan
  const handleOpenEditModal = (debt: DebtRecord) => {
    setDebtModalMode('edit');
    setEditingDebt(debt);
    setRawPrincipalAmount(debt.principalAmount.toLocaleString('id-ID'));
    resetDebtForm({
      type: debt.type,
      counterpartyName: debt.counterpartyName,
      principalAmount: debt.principalAmount,
      dueDate: debt.dueDate || '',
      notes: debt.notes || '',
    });
    setDebtModalOpen(true);
  };

  // Submit Simpan Utang (Tambah / Edit)
  const onSubmitDebt = async (values: DebtFormValues) => {
    if (!user) return;
    setIsSubmittingDebt(true);
    try {
      if (debtModalMode === 'create') {
        await createDebt(user.id, values);
        showToast({
          title: 'Berhasil Dicatat',
          description: `Catatan ${values.type === 'payable' ? 'utang' : 'piutang'} berhasil disimpan.`,
          variant: 'success',
        });
      } else if (editingDebt) {
        await updateDebt(user.id, editingDebt.id, values);
        showToast({
          title: 'Perubahan Disimpan',
          description: 'Catatan utang/piutang berhasil diperbarui.',
          variant: 'success',
        });
      }
      setDebtModalOpen(false);
      await loadData();
    } catch (err) {
      showToast({
        title: 'Gagal Menyimpan',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
        variant: 'error',
      });
    } finally {
      setIsSubmittingDebt(false);
    }
  };

  // Handler Buka Modal Catat Pembayaran
  const handleOpenPaymentModal = (debt: DebtRecord) => {
    setTargetDebtForPayment(debt);
    setLinkToWallet(false);
    const defaultPay = Math.min(debt.remainingAmount, 100000);
    setRawPaymentAmount(defaultPay.toLocaleString('id-ID'));
    resetPaymentForm({
      amount: defaultPay,
      paymentDate: toISODateString(),
      notes: '',
      accountId: wallets[0]?.id || '',
    });
    setPaymentModalOpen(true);
  };

  // Submit Catat Pembayaran
  const onSubmitPayment = async (values: DebtPaymentFormValues) => {
    if (!user || !targetDebtForPayment) return;
    setIsSubmittingPayment(true);
    try {
      await recordDebtPayment(user.id, targetDebtForPayment.id, {
        ...values,
        linkToAccount: linkToWallet,
        accountId: linkToWallet ? values.accountId : null,
      });

      showToast({
        title: 'Pembayaran Dicatat',
        description: `Pembayaran sebesar ${formatIDR(values.amount)} berhasil dibukukan.`,
        variant: 'success',
      });
      setPaymentModalOpen(false);
      await loadData();
    } catch (err) {
      showToast({
        title: 'Gagal Mencatat Pembayaran',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.',
        variant: 'error',
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handler Buka Riwayat Pembayaran
  const handleOpenHistoryModal = async (debt: DebtRecord) => {
    if (!user) return;
    setViewingDebtHistory(debt);
    setHistoryModalOpen(true);
    setIsLoadingPayments(true);
    try {
      const history = await fetchDebtPayments(user.id, debt.id);
      setDebtPaymentsList(history);
    } catch (err) {
      showToast({
        title: 'Gagal Memuat Riwayat',
        description: err instanceof Error ? err.message : 'Tidak dapat memuat pembayaran.',
        variant: 'error',
      });
    } finally {
      setIsLoadingPayments(false);
    }
  };

  // Submit Hapus Catatan Utang
  const handleConfirmDelete = async () => {
    if (!user || !deletingDebt) return;
    try {
      await deleteDebt(user.id, deletingDebt.id);
      showToast({
        title: 'Catatan Dihapus',
        description: 'Catatan utang/piutang dan riwayat pembayarannya telah dihapus.',
        variant: 'success',
      });
      setDeletingDebt(null);
      await loadData();
    } catch (err) {
      showToast({
        title: 'Gagal Menghapus',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan saat menghapus data.',
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
            Utang & Piutang
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Kelola kewajiban utang dan hak tagih piutang beserta riwayat pelunasan secara teratur.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenCreateModal('receivable')}
            className="flex items-center gap-2"
          >
            <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            + Piutang
          </Button>
          <Button
            variant="primary"
            onClick={() => handleOpenCreateModal('payable')}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            + Utang Baru
          </Button>
        </div>
      </div>

      {/* Kartu Ringkasan Keuangan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Utang (Payable) */}
        <Card className="border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Total Utang (Kewajiban)
              </span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
              {formatIDR(summary.totalPayableRemaining)}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Harus Anda bayarkan kepada pihak lain
            </p>
          </CardContent>
        </Card>

        {/* Total Piutang (Receivable) */}
        <Card className="border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Total Piutang (Hak Tagih)
              </span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
              {formatIDR(summary.totalReceivableRemaining)}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Akan Anda terima dari pihak lain
            </p>
          </CardContent>
        </Card>

        {/* Jatuh Tempo / Terlambat */}
        <Card className="border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Jatuh Tempo / Terlambat
              </span>
              <div className="rounded-lg bg-red-50 p-2 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold text-red-600 dark:text-red-400">
              {summary.overdueCount} Catatan
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {summary.overdueAmount > 0
                ? `Nominal: ${formatIDR(summary.overdueAmount)}`
                : 'Tidak ada tenggat terlewat'}
            </p>
          </CardContent>
        </Card>

        {/* Catatan Selesai Lunas */}
        <Card className="border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Sudah Lunas
              </span>
              <div className="rounded-lg bg-stone-100 p-2 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-bold text-stone-900 dark:text-stone-100">
              {summary.paidCount} / {summary.totalCount}
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Kewajiban terselesaikan sepenuhnya
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
                onClick={() => setTypeFilter('payable')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === 'payable'
                    ? 'bg-white text-finora-charcoal shadow-xs dark:bg-stone-800 dark:text-white'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
              >
                Utang (Kewajiban)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('receivable')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === 'receivable'
                    ? 'bg-white text-finora-charcoal shadow-xs dark:bg-stone-800 dark:text-white'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
              >
                Piutang (Hak Tagih)
              </button>
            </div>

            {/* Status Select & Search Input */}
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | DebtDisplayStatus)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-finora-charcoal focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              >
                <option value="all">Semua Status</option>
                <option value="unpaid">Belum Lunas / Berjalan</option>
                <option value="overdue">Jatuh Tempo (Terlambat)</option>
                <option value="paid">Lunas Penuh</option>
              </select>

              <div className="relative min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari pihak terkait..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-xs text-finora-charcoal placeholder-stone-400 focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Konten Utama: Daftar Kartu Utang & Piutang */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border border-stone-200 dark:border-stone-800">
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-2 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : errorMsg ? (
        <ErrorState
          title="Gagal Memuat Data"
          message={errorMsg}
          onRetry={loadData}
        />
      ) : filteredDebts.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={
            debts.length === 0
              ? 'Belum Ada Catatan Utang atau Piutang'
              : 'Tidak Ada Catatan yang Cocok'
          }
          description={
            debts.length === 0
              ? 'Catat kewajiban utang atau hak tagih piutang Anda agar keuangan tetap terpantau dengan rapi.'
              : 'Coba ubah kata kunci pencarian atau bersihkan filter jenis dan status yang aktif.'
          }
          actionLabel={debts.length === 0 ? '+ Catat Utang Pertama' : undefined}
          onAction={
            debts.length === 0
              ? () => handleOpenCreateModal('payable')
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredDebts.map((debt) => {
            const today = toISODateString();
            const displayStatus = resolveDebtStatus(debt, today);
            const paidAmount = debt.principalAmount - debt.remainingAmount;
            const progressPercent = Math.min(
              100,
              Math.max(0, Math.round((paidAmount / debt.principalAmount) * 100)),
            );

            return (
              <Card
                key={debt.id}
                className="flex flex-col justify-between border border-stone-200/80 bg-white transition-all hover:border-stone-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          debt.type === 'payable'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        }`}
                      >
                        {debt.type === 'payable' ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-stone-900 dark:text-stone-100">
                            {debt.counterpartyName}
                          </h3>
                        </div>
                        <span className="text-xs text-stone-500 dark:text-stone-400">
                          {debt.type === 'payable' ? 'Utang ke pihak ini' : 'Piutang dari pihak ini'}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {displayStatus === 'paid' && (
                        <Badge variant="income" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Lunas
                        </Badge>
                      )}
                      {displayStatus === 'overdue' && (
                        <Badge variant="expense" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Jatuh Tempo
                        </Badge>
                      )}
                      {displayStatus === 'partial' && (
                        <Badge variant="brand" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Sebagian
                        </Badge>
                      )}
                      {displayStatus === 'unpaid' && (
                        <Badge variant="warning" className="flex items-center gap-1">
                          Belum Dibayar
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-5 pt-0">
                  {/* Angka & Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        Sisa Kewajiban
                      </span>
                      <span className="text-base font-bold text-stone-900 dark:text-stone-100">
                        {formatIDR(debt.remainingAmount)}
                      </span>
                    </div>

                    {/* Progress Pelunasan */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          displayStatus === 'paid'
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : displayStatus === 'overdue'
                              ? 'bg-red-500'
                              : 'bg-finora-emerald'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                      <span>Terbayar: {formatIDR(paidAmount)}</span>
                      <span>Pokok: {formatIDR(debt.principalAmount)}</span>
                    </div>
                  </div>

                  {/* Tenggat Waktu & Catatan */}
                  <div className="space-y-1 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-600 dark:bg-stone-950/60 dark:text-stone-300">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
                        <Calendar className="h-3.5 w-3.5" />
                        Jatuh Tempo:
                      </span>
                      <span className={`font-medium ${displayStatus === 'overdue' ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                        {debt.dueDate ? formatDateID(debt.dueDate) : 'Tidak ada tenggat'}
                      </span>
                    </div>
                    {debt.notes && (
                      <p className="mt-1 line-clamp-2 border-t border-stone-200/60 pt-1 text-stone-500 italic dark:border-stone-800 dark:text-stone-400">
                        "{debt.notes}"
                      </p>
                    )}
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenHistoryModal(debt)}
                        className="h-8 gap-1 px-2.5 text-xs"
                      >
                        <History className="h-3.5 w-3.5" />
                        Riwayat
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(debt)}
                        className="h-8 px-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                        title="Edit Catatan"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingDebt(debt)}
                        className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                        title="Hapus Catatan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Button
                      variant={displayStatus === 'paid' ? 'outline' : 'primary'}
                      size="sm"
                      disabled={displayStatus === 'paid'}
                      onClick={() => handleOpenPaymentModal(debt)}
                      className="h-8 text-xs font-medium"
                    >
                      {displayStatus === 'paid' ? 'Lunas' : 'Catat Pembayaran'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: TAMBAH / EDIT CATATAN UTANG ATAU PIUTANG        */}
      {/* ======================================================== */}
      <Modal
        open={debtModalOpen}
        onClose={() => setDebtModalOpen(false)}
        title={
          debtModalMode === 'create'
            ? 'Tambah Catatan Utang / Piutang'
            : 'Perbarui Catatan Utang / Piutang'
        }
        description="Pastikan pihak terkait dan nominal awal terisi dengan benar."
      >
        <form onSubmit={handleSubmitDebt(onSubmitDebt)} className="space-y-4">
          {/* Pilihan Jenis (Payable / Receivable) */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Jenis Kewajiban
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={debtModalMode === 'edit'}
                onClick={() => setDebtValue('type', 'payable')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                  debtModalMode === 'edit' ? 'opacity-60 cursor-not-allowed' : ''
                } ${
                  registerDebt('type').name && debtModalMode === 'edit'
                    ? editingDebt?.type === 'payable'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200'
                      : 'border-stone-200 text-stone-500 dark:border-stone-700'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-300'
                }`}
              >
                <ArrowUpRight className="h-4 w-4 text-amber-600" />
                Utang (Kewajiban)
              </button>
              <button
                type="button"
                disabled={debtModalMode === 'edit'}
                onClick={() => setDebtValue('type', 'receivable')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                  debtModalMode === 'edit' ? 'opacity-60 cursor-not-allowed' : ''
                } ${
                  debtModalMode === 'edit'
                    ? editingDebt?.type === 'receivable'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'border-stone-200 text-stone-500 dark:border-stone-700'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-300'
                }`}
              >
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                Piutang (Hak Tagih)
              </button>
            </div>
          </div>

          {/* Nama Pihak Terkait */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Nama Pihak Terkait (Orang / Lembaga)
            </label>
            <Input
              {...registerDebt('counterpartyName')}
              placeholder="Contoh: Budi Santoso, Bank Mandiri, Teman Kantor"
              className="mt-1"
            />
            {debtErrors.counterpartyName && (
              <p className="mt-1 text-xs text-red-500">
                {debtErrors.counterpartyName.message}
              </p>
            )}
          </div>

          {/* Nominal Pokok Awal */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Nominal Pokok (Rupiah)
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500">
                Rp
              </span>
              <Input
                type="text"
                disabled={debtModalMode === 'edit'}
                value={rawPrincipalAmount}
                onChange={(e) => {
                  const safe = parseIDRInput(e.target.value);
                  setRawPrincipalAmount(
                    safe > 0 ? safe.toLocaleString('id-ID') : '',
                  );
                  setDebtValue('principalAmount', safe, {
                    shouldValidate: true,
                  });
                }}
                placeholder="500.000"
                className="pl-9"
              />
            </div>
            {debtModalMode === 'edit' && (
              <p className="mt-1 text-xs text-stone-400">
                Nominal pokok terkunci untuk melindungi konsistensi riwayat pelunasan.
              </p>
            )}
            {debtErrors.principalAmount && (
              <p className="mt-1 text-xs text-red-500">
                {debtErrors.principalAmount.message}
              </p>
            )}
          </div>

          {/* Tanggal Jatuh Tempo */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Tanggal Jatuh Tempo (Opsional)
            </label>
            <Input
              type="date"
              {...registerDebt('dueDate')}
              className="mt-1"
            />
            {debtErrors.dueDate && (
              <p className="mt-1 text-xs text-red-500">
                {debtErrors.dueDate.message}
              </p>
            )}
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Catatan / Keterangan (Opsional)
            </label>
            <textarea
              {...registerDebt('notes')}
              rows={2}
              placeholder="Contoh: Pinjaman modal usaha, jatuh tempo tiap tanggal 15."
              className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-2.5 text-xs text-stone-900 placeholder-stone-400 focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDebtModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingDebt}
            >
              {isSubmittingDebt ? 'Menyimpan...' : 'Simpan Catatan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: CATAT PEMBAYARAN CICILAN / PELUNASAN            */}
      {/* ======================================================== */}
      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={
          targetDebtForPayment?.type === 'payable'
            ? 'Catat Pembayaran Utang'
            : 'Catat Pelunasan Piutang'
        }
        description={`Pihak: ${targetDebtForPayment?.counterpartyName || ''} | Sisa kewajiban: ${formatIDR(
          targetDebtForPayment?.remainingAmount || 0,
        )}`}
      >
        <form onSubmit={handleSubmitPayment(onSubmitPayment)} className="space-y-4">
          {/* Nominal Pembayaran */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Nominal Pembayaran (Rupiah)
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!targetDebtForPayment) return;
                  setRawPaymentAmount(
                    targetDebtForPayment.remainingAmount.toLocaleString('id-ID'),
                  );
                  setPaymentValue('amount', targetDebtForPayment.remainingAmount, {
                    shouldValidate: true,
                  });
                }}
                className="text-xs font-semibold text-finora-emerald hover:underline"
              >
                Bayar Penuh ({formatIDR(targetDebtForPayment?.remainingAmount || 0)})
              </button>
            </div>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-500">
                Rp
              </span>
              <Input
                type="text"
                value={rawPaymentAmount}
                onChange={(e) => {
                  const safe = parseIDRInput(e.target.value);
                  setRawPaymentAmount(
                    safe > 0 ? safe.toLocaleString('id-ID') : '',
                  );
                  setPaymentValue('amount', safe, {
                    shouldValidate: true,
                  });
                }}
                placeholder="100.000"
                className="pl-9"
              />
            </div>
            {paymentErrors.amount && (
              <p className="mt-1 text-xs text-red-500">
                {paymentErrors.amount.message}
              </p>
            )}
          </div>

          {/* Tanggal Pembayaran */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Tanggal Transaksi
            </label>
            <Input
              type="date"
              {...registerPayment('paymentDate')}
              className="mt-1"
            />
            {paymentErrors.paymentDate && (
              <p className="mt-1 text-xs text-red-500">
                {paymentErrors.paymentDate.message}
              </p>
            )}
          </div>

          {/* Opsi Hubungkan ke Dompet */}
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-950/60">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={linkToWallet}
                onChange={(e) => setLinkToWallet(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-finora-emerald focus:ring-finora-emerald"
              />
              <span className="text-xs font-medium text-stone-800 dark:text-stone-200">
                Hubungkan dengan Rekening / Dompet
              </span>
            </label>

            {linkToWallet && (
              <div className="mt-3 space-y-2 border-t border-stone-200/80 pt-2.5 dark:border-stone-800">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Pilih Rekening
                </label>
                <select
                  {...registerPayment('accountId')}
                  className="w-full rounded-lg border border-stone-200 bg-white p-2 text-xs text-stone-900 focus:border-finora-emerald focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatIDR(w.currentBalance)})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {targetDebtForPayment?.type === 'payable'
                    ? 'Saldo rekening terpilih akan otomatis didebit (pengeluaran).'
                    : 'Saldo rekening terpilih akan otomatis dikredit (pemasukan).'}
                </p>
              </div>
            )}
          </div>

          {/* Catatan Pembayaran */}
          <div>
            <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
              Catatan Pembayaran (Opsional)
            </label>
            <Input
              {...registerPayment('notes')}
              placeholder="Contoh: Cicilan ke-1 transfer via BCA"
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingPayment}
            >
              {isSubmittingPayment ? 'Memproses...' : 'Konfirmasi Pembayaran'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: RIWAYAT PEMBAYARAN CICILAN                      */}
      {/* ======================================================== */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Riwayat Pembayaran"
        description={`Kewajiban: ${viewingDebtHistory?.counterpartyName || ''} (${
          viewingDebtHistory?.type === 'payable' ? 'Utang' : 'Piutang'
        })`}
      >
        <div className="space-y-4">
          {isLoadingPayments ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : debtPaymentsList.length === 0 ? (
            <div className="py-8 text-center">
              <History className="mx-auto h-8 w-8 text-stone-400" />
              <p className="mt-2 text-xs font-medium text-stone-600 dark:text-stone-300">
                Belum ada riwayat pembayaran tercatat.
              </p>
            </div>
          ) : (
            <div className="max-h-64 divide-y divide-stone-100 overflow-y-auto dark:divide-stone-800">
              {debtPaymentsList.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      {formatIDR(p.amount)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                      <span>{formatDateID(p.paymentDate)}</span>
                      {p.notes && <span>• {p.notes}</span>}
                    </div>
                  </div>
                  {p.transactionId && (
                    <Badge variant="default" className="text-[10px]">
                      Tercatat di Dompet
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHistoryModalOpen(false)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={Boolean(deletingDebt)}
        title="Hapus Catatan Utang / Piutang?"
        description={`Tindakan ini akan menghapus catatan "${deletingDebt?.counterpartyName || ''}" beserta seluruh riwayat pembayarannya. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingDebt(null)}
      />
    </div>
  );
}

export default DebtsPage;
