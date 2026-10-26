import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  PieChart as PieChartIcon,
  Plus,
  Trash2,
} from 'lucide-react';
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
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAuth } from '@/hooks/useAuth';
import { formatIDR, parseIDRInput } from '@/lib/currency';
import { formatMonthYearID, getCurrentMonthPeriod } from '@/lib/date';
import {
  calculateBudgetRealization,
  type BudgetRealization,
} from '@/lib/finance/planning';
import {
  budgetFormSchema,
  type BudgetFormValues,
} from '@/schemas/planning.schema';
import {
  createBudget,
  deleteBudget,
  fetchBudgets,
  updateBudget,
} from '@/services/budget.service';
import { fetchCategories } from '@/services/category.service';
import { fetchTransactions } from '@/services/transaction.service';
import type { Budget, Category, Transaction } from '@/types/domain';

export function BudgetsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const currentPeriod = useMemo(() => getCurrentMonthPeriod(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentPeriod.month);
  const [selectedYear, setSelectedYear] = useState<number>(currentPeriod.year);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);
  const [rawAmount, setRawAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoryId: null,
      periodMonth: currentPeriod.month,
      periodYear: currentPeriod.year,
      amountLimit: 1000000,
      alertThresholdPercent: 80,
    },
  });

  const periodLabel = useMemo(
    () => formatMonthYearID(selectedMonth, selectedYear),
    [selectedMonth, selectedYear],
  );

  const loadBudgetData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const monthStr = String(selectedMonth).padStart(2, '0');
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const startDate = `${selectedYear}-${monthStr}-01`;
      const endDate = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const [loadedBudgets, loadedCategories, txRes] = await Promise.all([
        fetchBudgets(user.id, selectedYear, selectedMonth),
        fetchCategories(user.id, { includeArchived: false }),
        fetchTransactions(user.id, {
          startDate,
          endDate,
          type: 'expense',
          page: 1,
          pageSize: 500,
        }),
      ]);

      setBudgets(loadedBudgets);
      setCategories(loadedCategories.filter((c) => c.type === 'expense'));
      setMonthTransactions(txRes.items);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat data anggaran.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedMonth, selectedYear]);

  useEffect(() => {
    void loadBudgetData();
  }, [loadBudgetData]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  // Kalkulasi realisasi anggaran
  const budgetRealizations = useMemo<BudgetRealization[]>(() => {
    return budgets.map((b) =>
      calculateBudgetRealization(b, monthTransactions),
    );
  }, [budgets, monthTransactions]);

  const overallBudgetRealization = useMemo(() => {
    return budgetRealizations.find((r) => r.isOverall) ?? null;
  }, [budgetRealizations]);

  const categoryBudgetRealizations = useMemo(() => {
    return budgetRealizations.filter((r) => !r.isOverall);
  }, [budgetRealizations]);

  // Navigasi periode bulan
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingBudget(null);
    reset({
      categoryId: null,
      periodMonth: selectedMonth,
      periodYear: selectedYear,
      amountLimit: 1000000,
      alertThresholdPercent: 80,
    });
    setRawAmount('1.000.000');
    setModalOpen(true);
  };

  const openEditModal = (b: Budget) => {
    setModalMode('edit');
    setEditingBudget(b);
    reset({
      categoryId: b.categoryId,
      periodMonth: b.periodMonth,
      periodYear: b.periodYear,
      amountLimit: b.amountLimit,
      alertThresholdPercent: b.alertThresholdPercent,
    });
    setRawAmount(b.amountLimit.toLocaleString('id-ID'));
    setModalOpen(true);
  };

  const handleAmountChange = (val: string) => {
    const parsed = parseIDRInput(val);
    setRawAmount(val.trim() === '' ? '' : parsed.toLocaleString('id-ID'));
    setValue('amountLimit', parsed, { shouldValidate: true });
  };

  const onValidSubmit = async (values: BudgetFormValues) => {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (modalMode === 'edit' && editingBudget) {
        await updateBudget(user.id, editingBudget.id, values);
        showToast({
          title: 'Anggaran Diperbarui',
          description: 'Batas anggaran bulanan berhasil disimpan.',
          variant: 'success',
        });
      } else {
        await createBudget(user.id, values);
        showToast({
          title: 'Anggaran Ditetapkan',
          description: `Anggaran sebesar ${formatIDR(values.amountLimit)} berhasil dibuat untuk ${periodLabel}.`,
          variant: 'success',
        });
      }
      setModalOpen(false);
      await loadBudgetData();
    } catch (err) {
      showToast({
        title: 'Gagal Menyimpan Anggaran',
        description:
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat menyimpan anggaran.',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingBudget) return;
    try {
      await deleteBudget(user.id, deletingBudget.id);
      showToast({
        title: 'Anggaran Dihapus',
        description: 'Batas anggaran periode ini telah dihapus.',
        variant: 'info',
      });
      setDeletingBudget(null);
      await loadBudgetData();
    } catch (err) {
      showToast({
        title: 'Gagal Menghapus Anggaran',
        description:
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat menghapus anggaran.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Periode */}
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-5 shadow-subtle lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Anggaran Bulanan
            </h2>
            <Badge variant="brand">{periodLabel}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Tetapkan batas pengeluaran bulanan dan pantau realisasi pemakaian
            secara akurat tanpa terpengaruh transfer internal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Kontrol Navigasi Periode Bulan */}
          <div className="flex items-center rounded-md border border-border bg-surface px-1 py-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Bulan sebelumnya"
              className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="flex items-center gap-1.5 px-3 text-xs font-semibold text-foreground">
              <Calendar className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Bulan berikutnya"
              className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Tetapkan Anggaran
          </Button>
        </div>
      </section>

      {/* Kartu Anggaran Keseluruhan (Jika Ada) */}
      {overallBudgetRealization ? (
        <Card className="border-brand/30 bg-surface">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Anggaran Pengeluaran Keseluruhan
                  </CardTitle>
                  <Badge
                    variant={
                      overallBudgetRealization.status === 'over'
                        ? 'expense'
                        : overallBudgetRealization.status === 'warning'
                          ? 'warning'
                          : 'income'
                    }
                  >
                    {overallBudgetRealization.percentage}%
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Batas total seluruh pos pengeluaran pada {periodLabel}.
                </CardDescription>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditModal(overallBudgetRealization.budget)}
                  aria-label="Edit anggaran keseluruhan"
                  className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeletingBudget(overallBudgetRealization.budget)
                  }
                  aria-label="Hapus anggaran keseluruhan"
                  className="rounded-md p-1.5 text-muted hover:bg-semantic-expense-soft hover:text-semantic-expense"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-xs text-muted">
                Terpakai:{' '}
                <strong className="text-foreground">
                  {formatIDR(overallBudgetRealization.spent)}
                </strong>{' '}
                dari batas{' '}
                <strong>
                  {formatIDR(overallBudgetRealization.budget.amountLimit)}
                </strong>
              </span>
              <span className="text-xs font-semibold">
                {overallBudgetRealization.remaining >= 0 ? (
                  <span className="text-semantic-income">
                    Sisa ruang: {formatIDR(overallBudgetRealization.remaining)}
                  </span>
                ) : (
                  <span className="text-semantic-expense">
                    Melebihi:{' '}
                    {formatIDR(Math.abs(overallBudgetRealization.remaining))}
                  </span>
                )}
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={Math.round(overallBudgetRealization.percentage)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  overallBudgetRealization.status === 'over'
                    ? 'bg-semantic-expense'
                    : overallBudgetRealization.status === 'warning'
                      ? 'bg-semantic-warning'
                      : 'bg-brand'
                }`}
                style={{
                  width: `${Math.min(100, overallBudgetRealization.percentage)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Daftar Anggaran per Kategori */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Anggaran per Kategori</CardTitle>
              <CardDescription>
                Pemantauan realisasi pengeluaran bulanan per pos kategori.
              </CardDescription>
            </div>
            <span className="text-xs text-muted">
              {categoryBudgetRealizations.length} Anggaran Aktif
            </span>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : errorMsg ? (
            <ErrorState
              title="Gagal Memuat Anggaran"
              message={errorMsg}
              onRetry={() => void loadBudgetData()}
            />
          ) : categoryBudgetRealizations.length === 0 &&
            !overallBudgetRealization ? (
            <EmptyState
              icon={PieChartIcon}
              title={`Belum Ada Anggaran untuk ${periodLabel}`}
              description="Tetapkan batas pengeluaran untuk kategori makanan, transportasi, tagihan, atau anggaran keseluruhan agar pengeluaran Anda terkendali."
              actionLabel="Tetapkan Anggaran Pertama"
              onAction={openCreateModal}
            />
          ) : (
            <div className="space-y-5">
              {categoryBudgetRealizations.map((item) => {
                const cat = item.budget.categoryId
                  ? categoryMap.get(item.budget.categoryId)
                  : undefined;
                const catName = cat?.name ?? 'Kategori Pengeluaran';
                const catColor = cat?.color ?? '#176B52';

                return (
                  <div
                    key={item.budget.id}
                    className="rounded-lg border border-border bg-surface p-4 transition-all hover:border-brand/40"
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: catColor }}
                          aria-hidden="true"
                        />
                        <h4 className="text-sm font-semibold text-foreground">
                          {catName}
                        </h4>
                        <Badge
                          variant={
                            item.status === 'over'
                              ? 'expense'
                              : item.status === 'warning'
                                ? 'warning'
                                : 'income'
                          }
                        >
                          {item.percentage}%
                        </Badge>
                        {item.status === 'warning' ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-semantic-warning">
                            <AlertCircle className="h-3 w-3" />
                            Mendekati Batas ({item.budget.alertThresholdPercent}%)
                          </span>
                        ) : item.status === 'over' ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-semantic-expense">
                            <AlertCircle className="h-3 w-3" />
                            Melebihi Anggaran!
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted">
                            <CheckCircle2 className="h-3 w-3 text-brand" />
                            Terkendali
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => openEditModal(item.budget)}
                          aria-label={`Edit anggaran ${catName}`}
                          className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingBudget(item.budget)}
                          aria-label={`Hapus anggaran ${catName}`}
                          className="rounded-md p-1.5 text-muted hover:bg-semantic-expense-soft hover:text-semantic-expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between text-xs text-muted">
                      <span>
                        Realisasi Pengeluaran:{' '}
                        <strong className="text-foreground">
                          {formatIDR(item.spent)}
                        </strong>{' '}
                        / Batas {formatIDR(item.budget.amountLimit)}
                      </span>
                      <span>
                        {item.remaining >= 0 ? (
                          <span className="font-medium text-semantic-income">
                            Sisa: {formatIDR(item.remaining)}
                          </span>
                        ) : (
                          <span className="font-semibold text-semantic-expense">
                            Defisit: {formatIDR(Math.abs(item.remaining))}
                          </span>
                        )}
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(item.percentage)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.status === 'over'
                            ? 'bg-semantic-expense'
                            : item.status === 'warning'
                              ? 'bg-semantic-warning'
                              : 'bg-brand'
                        }`}
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Form Tambah / Edit Anggaran */}
      <Modal
        open={modalOpen}
        onClose={isSubmitting ? () => undefined : () => setModalOpen(false)}
        title={
          modalMode === 'edit'
            ? 'Edit Batas Anggaran'
            : 'Tetapkan Anggaran Bulanan'
        }
        description={`Tentukan batas pengeluaran untuk periode ${periodLabel}.`}
      >
        <form
          onSubmit={handleSubmit(onValidSubmit)}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="budget-category"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Cakupan Anggaran
            </label>
            <select
              id="budget-category"
              disabled={isSubmitting}
              value={editingBudget ? (editingBudget.categoryId ?? '') : undefined}
              onChange={(e) => {
                const val = e.target.value.trim();
                setValue('categoryId', val === '' ? null : val, {
                  shouldValidate: true,
                });
              }}
              className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <option value="">Seluruh Pengeluaran (Anggaran Keseluruhan)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  Kategori: {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="budget-amount"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Batas Anggaran (Integer Rupiah)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-muted">
                Rp
              </span>
              <Input
                id="budget-amount"
                inputMode="numeric"
                disabled={isSubmitting}
                value={rawAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="Contoh: 2.500.000"
                className="pl-9 tabular-nums font-medium"
              />
            </div>
            {errors.amountLimit ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.amountLimit.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="budget-alert"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Peringatan pada Ambang Batas (%)
            </label>
            <Input
              id="budget-alert"
              type="number"
              min={1}
              max={100}
              disabled={isSubmitting}
              placeholder="80"
              {...register('alertThresholdPercent', { valueAsNumber: true })}
            />
            <p className="mt-1 text-[11px] text-muted">
              Finora AI akan menandai peringatan warna kuning saat pemakaian
              mencapai persentase ini.
            </p>
            {errors.alertThresholdPercent ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.alertThresholdPercent.message}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Anggaran'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Dialog Konfirmasi Hapus Anggaran */}
      <ConfirmDialog
        open={Boolean(deletingBudget)}
        onClose={() => setDeletingBudget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Hapus Anggaran Ini?"
        description="Batas anggaran untuk pos ini akan dihapus dari pemantauan bulanan."
        confirmLabel="Ya, Hapus Anggaran"
        variant="danger"
      />
    </div>
  );
}

