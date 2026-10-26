import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle2,
  Clock,
  History,
  MinusCircle,
  Pencil,
  PiggyBank,
  Plus,
  PlusCircle,
  Sparkles,
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
import { formatDateID, toISODateString } from '@/lib/date';
import { simulateSavingsPlan } from '@/lib/finance/planning';
import {
  savingsContributionFormSchema,
  savingsGoalFormSchema,
  type SavingsContributionFormValues,
  type SavingsGoalFormValues,
} from '@/schemas/planning.schema';
import {
  createSavingsGoal,
  deleteSavingsGoal,
  fetchSavingsContributions,
  fetchSavingsGoals,
  recordSavingsContribution,
  updateSavingsGoal,
} from '@/services/savings.service';
import { fetchWallets } from '@/services/wallet.service';
import type { Account, SavingsContribution, SavingsGoal } from '@/types/domain';

export function SavingsGoalsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [wallets, setWallets] = useState<Account[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [contributions, setContributions] = useState<SavingsContribution[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingContrib, setIsLoadingContrib] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Buat/Edit Target Tabungan
  const [goalModalOpen, setGoalModalOpen] = useState<boolean>(false);
  const [goalModalMode, setGoalModalMode] = useState<'create' | 'edit'>('create');
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<SavingsGoal | null>(null);
  const [rawTargetAmount, setRawTargetAmount] = useState<string>('');
  const [isSubmittingGoal, setIsSubmittingGoal] = useState<boolean>(false);

  // Modal Catat Alokasi (Deposit/Withdraw)
  const [contribModalOpen, setContribModalOpen] = useState<boolean>(false);
  const [contribType, setContribType] = useState<'deposit' | 'withdraw'>('deposit');
  const [rawContribAmount, setRawContribAmount] = useState<string>('');
  const [isSubmittingContrib, setIsSubmittingContrib] = useState<boolean>(false);

  const {
    register: registerGoal,
    handleSubmit: handleSubmitGoal,
    setValue: setGoalValue,
    reset: resetGoalForm,
    formState: { errors: goalErrors },
  } = useForm<SavingsGoalFormValues>({
    resolver: zodResolver(savingsGoalFormSchema),
    defaultValues: {
      name: '',
      targetAmount: 5000000,
      currentAmount: 0,
      targetDate: '',
      accountId: '',
      notes: '',
    },
  });

  const {
    register: registerContrib,
    handleSubmit: handleSubmitContrib,
    setValue: setContribValue,
    reset: resetContribForm,
    formState: { errors: contribErrors },
  } = useForm<SavingsContributionFormValues>({
    resolver: zodResolver(savingsContributionFormSchema),
    defaultValues: {
      amount: 100000,
      type: 'deposit',
      accountId: '',
      contributionDate: toISODateString(),
      notes: '',
    },
  });

  const loadGoals = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [loadedGoals, loadedWallets] = await Promise.all([
        fetchSavingsGoals(user.id),
        fetchWallets(user.id, { includeArchived: false }),
      ]);
      setGoals(loadedGoals);
      setWallets(loadedWallets);

      if (loadedGoals.length > 0 && !selectedGoalId) {
        setSelectedGoalId(loadedGoals[0].id);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat target tabungan.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedGoalId]);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  // Muat riwayat kontribusi untuk goal terpilih
  useEffect(() => {
    if (!user || !selectedGoalId) {
      setContributions([]);
      return;
    }
    let isMounted = true;
    setIsLoadingContrib(true);
    fetchSavingsContributions(user.id, selectedGoalId)
      .then((items) => {
        if (isMounted) setContributions(items);
      })
      .catch(() => {
        if (isMounted) setContributions([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingContrib(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user, selectedGoalId]);

  const selectedGoal = useMemo(
    () => goals.find((g) => g.id === selectedGoalId) ?? null,
    [goals, selectedGoalId],
  );

  const selectedGoalSimulation = useMemo(() => {
    if (!selectedGoal) return null;
    return simulateSavingsPlan(selectedGoal);
  }, [selectedGoal]);

  const openCreateGoalModal = () => {
    setGoalModalMode('create');
    setEditingGoal(null);
    resetGoalForm({
      name: '',
      targetAmount: 5000000,
      currentAmount: 0,
      targetDate: '',
      accountId: wallets[0]?.id ?? '',
      notes: '',
    });
    setRawTargetAmount('5.000.000');
    setGoalModalOpen(true);
  };

  const openEditGoalModal = (g: SavingsGoal) => {
    setGoalModalMode('edit');
    setEditingGoal(g);
    resetGoalForm({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      targetDate: g.targetDate ?? '',
      accountId: g.accountId ?? '',
      notes: g.notes ?? '',
    });
    setRawTargetAmount(g.targetAmount.toLocaleString('id-ID'));
    setGoalModalOpen(true);
  };

  const openContribModal = (type: 'deposit' | 'withdraw') => {
    if (!selectedGoal) return;
    setContribType(type);
    resetContribForm({
      amount: 100000,
      type,
      accountId: selectedGoal.accountId ?? wallets[0]?.id ?? '',
      contributionDate: toISODateString(),
      notes: '',
    });
    setRawContribAmount('100.000');
    setContribModalOpen(true);
  };

  const handleTargetAmountChange = (val: string) => {
    const parsed = parseIDRInput(val);
    setRawTargetAmount(val.trim() === '' ? '' : parsed.toLocaleString('id-ID'));
    setGoalValue('targetAmount', parsed, { shouldValidate: true });
  };

  const handleContribAmountChange = (val: string) => {
    const parsed = parseIDRInput(val);
    setRawContribAmount(val.trim() === '' ? '' : parsed.toLocaleString('id-ID'));
    setContribValue('amount', parsed, { shouldValidate: true });
  };

  const onValidSubmitGoal = async (values: SavingsGoalFormValues) => {
    if (!user || isSubmittingGoal) return;
    setIsSubmittingGoal(true);
    try {
      if (goalModalMode === 'edit' && editingGoal) {
        await updateSavingsGoal(user.id, editingGoal.id, values);
        showToast({
          title: 'Target Tabungan Diperbarui',
          description: `Target "${values.name}" berhasil disimpan.`,
          variant: 'success',
        });
      } else {
        const created = await createSavingsGoal(user.id, values);
        setSelectedGoalId(created.id);
        showToast({
          title: 'Target Tabungan Dibuat',
          description: `Target "${created.name}" sebesar ${formatIDR(created.targetAmount)} siap dimulai.`,
          variant: 'success',
        });
      }
      setGoalModalOpen(false);
      await loadGoals();
    } catch (err) {
      showToast({
        title: 'Gagal Menyimpan Target',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
        variant: 'error',
      });
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  const onValidSubmitContrib = async (values: SavingsContributionFormValues) => {
    if (!user || !selectedGoal || isSubmittingContrib) return;
    setIsSubmittingContrib(true);
    try {
      await recordSavingsContribution(user.id, selectedGoal.id, values);
      showToast({
        title:
          values.type === 'deposit'
            ? 'Alokasi Tabungan Bertambah'
            : 'Penarikan Tabungan Berhasil',
        description: `${values.type === 'deposit' ? '+' : '-'}${formatIDR(values.amount)} berhasil dicatat untuk target "${selectedGoal.name}".`,
        variant: 'success',
      });
      setContribModalOpen(false);
      await loadGoals();
      const updatedContribs = await fetchSavingsContributions(
        user.id,
        selectedGoal.id,
      );
      setContributions(updatedContribs);
    } catch (err) {
      showToast({
        title: 'Gagal Mencatat Alokasi',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
        variant: 'error',
      });
    } finally {
      setIsSubmittingContrib(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deletingGoal) return;
    try {
      await deleteSavingsGoal(user.id, deletingGoal.id);
      showToast({
        title: 'Target Tabungan Dihapus',
        description: `Target "${deletingGoal.name}" telah dihapus.`,
        variant: 'info',
      });
      setDeletingGoal(null);
      await loadGoals();
    } catch (err) {
      showToast({
        title: 'Gagal Menghapus Target',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-5 shadow-subtle lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Target Tabungan
            </h2>
            <Badge variant="brand">{goals.length} Rencana</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Rencanakan dana darurat, liburan, atau pembelian penting dan pantau
            simulasi tabungan berkala.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={openCreateGoalModal}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Tambah Target Tabungan
        </Button>
      </section>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : errorMsg ? (
        <ErrorState
          title="Gagal Memuat Target Tabungan"
          message={errorMsg}
          onRetry={() => void loadGoals()}
        />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Belum Ada Target Tabungan"
          description="Mulai rencanakan target keuangan Anda. Finora AI akan membantu menghitung simulasi tabungan per minggu atau per bulan."
          actionLabel="Buat Target Pertama"
          onAction={openCreateGoalModal}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Kolom Kiri: Daftar Kartu Target Tabungan */}
          <div className="space-y-3 lg:col-span-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Daftar Target ({goals.length})
            </h3>

            {goals.map((g) => {
              const isSelected = g.id === selectedGoalId;
              const sim = simulateSavingsPlan(g);
              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGoalId(g.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedGoalId(g.id);
                    }
                  }}
                  className={`cursor-pointer rounded-lg border p-4 transition-all ${
                    isSelected
                      ? 'border-brand bg-brand-soft/25 shadow-subtle'
                      : 'border-border bg-surface hover:border-brand/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground">
                        <PiggyBank className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {g.name}
                          </p>
                          {sim.isCompleted ? (
                            <Badge variant="income">Tercapai</Badge>
                          ) : (
                            <Badge variant="default">{sim.percentage}%</Badge>
                          )}
                        </div>
                        {g.targetDate ? (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                            <Clock className="h-3 w-3" />
                            Target: {formatDateID(g.targetDate)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openEditGoalModal(g)}
                        aria-label={`Edit target ${g.name}`}
                        className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingGoal(g)}
                        aria-label={`Hapus target ${g.name}`}
                        className="rounded-md p-1.5 text-muted hover:bg-semantic-expense-soft hover:text-semantic-expense"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-xs text-muted">
                      <span>
                        Terkumpul:{' '}
                        <strong className="text-foreground">
                          {formatIDR(g.currentAmount)}
                        </strong>
                      </span>
                      <span>Target: {formatIDR(g.targetAmount)}</span>
                    </div>

                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(sim.percentage)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                    >
                      <div
                        className="h-full rounded-full bg-brand transition-all duration-300"
                        style={{ width: `${Math.min(100, sim.percentage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Kolom Kanan: Detail Target, Simulasi & Riwayat Mutasi */}
          <div className="space-y-4 lg:col-span-7">
            {selectedGoal && selectedGoalSimulation ? (
              <>
                {/* Kartu Detail & Simulasi Tabungan Berkala */}
                <Card className="border-brand/25">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            {selectedGoal.name}
                          </CardTitle>
                          {selectedGoalSimulation.isCompleted ? (
                            <Badge variant="income">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Target Tercapai!
                            </Badge>
                          ) : (
                            <Badge variant="brand">
                              {selectedGoalSimulation.percentage}% Selesai
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs">
                          {selectedGoal.notes ||
                            'Rencana akumulasi dana terstruktur.'}
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openContribModal('withdraw')}
                          disabled={selectedGoal.currentAmount <= 0}
                        >
                          <MinusCircle className="h-3.5 w-3.5" />
                          Tarik Dana
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openContribModal('deposit')}
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          Tambah Alokasi
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3 text-xs">
                      <div className="rounded-md border border-border bg-surface-muted/40 p-3">
                        <span className="block text-muted">Saldo Saat Ini</span>
                        <span className="tabular-nums text-base font-bold text-foreground">
                          {formatIDR(selectedGoal.currentAmount)}
                        </span>
                      </div>
                      <div className="rounded-md border border-border bg-surface-muted/40 p-3">
                        <span className="block text-muted">Nominal Target</span>
                        <span className="tabular-nums text-base font-bold text-brand">
                          {formatIDR(selectedGoal.targetAmount)}
                        </span>
                      </div>
                      <div className="rounded-md border border-border bg-surface-muted/40 p-3">
                        <span className="block text-muted">Sisa Kebutuhan</span>
                        <span className="tabular-nums text-base font-bold text-foreground">
                          {formatIDR(selectedGoalSimulation.remainingAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Simulasi Finora AI */}
                    {!selectedGoalSimulation.isCompleted &&
                    selectedGoal.targetDate ? (
                      <div className="rounded-lg border border-brand/20 bg-brand-soft/30 p-3.5 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-brand" />
                          Simulasi Rencana Tabungan Berkala:
                        </div>
                        <p className="mt-1 leading-relaxed text-muted">
                          Tersisa{' '}
                          <strong>
                            {selectedGoalSimulation.daysRemaining} hari
                          </strong>{' '}
                          (~{selectedGoalSimulation.monthsRemaining} bulan)
                          menuju tenggat {formatDateID(selectedGoal.targetDate)}.
                          Anda disarankan menyisihkan:{' '}
                          <strong className="text-foreground">
                            {formatIDR(selectedGoalSimulation.requiredPerMonth)}
                            /bulan
                          </strong>{' '}
                          atau{' '}
                          <strong className="text-foreground">
                            {formatIDR(selectedGoalSimulation.requiredPerWeek)}
                            /minggu
                          </strong>
                          .
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Riwayat Mutasi Alokasi Tabungan */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-brand" />
                        <CardTitle className="text-sm">
                          Riwayat Alokasi Dana Tabungan
                        </CardTitle>
                      </div>
                      <span className="text-xs text-muted">
                        {contributions.length} Mutasi
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {isLoadingContrib ? (
                      <Skeleton className="h-12 w-full" />
                    ) : contributions.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted">
                        Belum ada riwayat alokasi dana untuk target ini. Klik
                        &quot;Tambah Alokasi&quot; untuk mencatat setoran
                        pertama.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border text-xs">
                        {contributions.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  {c.type === 'deposit'
                                    ? 'Alokasi Masuk'
                                    : 'Penarikan Dana'}
                                </span>
                                <Badge
                                  variant={
                                    c.type === 'deposit' ? 'income' : 'expense'
                                  }
                                >
                                  {c.type === 'deposit'
                                    ? '+ Simpanan'
                                    : '- Tarik'}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted">
                                {formatDateID(c.contributionDate)}{' '}
                                {c.notes ? `• ${c.notes}` : ''}
                              </p>
                            </div>

                            <span
                              className={`tabular-nums font-bold ${
                                c.type === 'deposit'
                                  ? 'text-semantic-income'
                                  : 'text-semantic-expense'
                              }`}
                            >
                              {c.type === 'deposit'
                                ? `+${formatIDR(c.amount)}`
                                : `-${formatIDR(c.amount)}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal Buat / Edit Target Tabungan */}
      <Modal
        open={goalModalOpen}
        onClose={isSubmittingGoal ? () => undefined : () => setGoalModalOpen(false)}
        title={
          goalModalMode === 'edit'
            ? 'Edit Target Tabungan'
            : 'Target Tabungan Baru'
        }
        description="Tetapkan nominal tujuan dan batas waktu pencapaian dana."
      >
        <form
          onSubmit={handleSubmitGoal(onValidSubmitGoal)}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="goal-name"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Nama Rencana Target
            </label>
            <Input
              id="goal-name"
              disabled={isSubmittingGoal}
              placeholder="Contoh: Dana Darurat 6 Bulan, Liburan Akhir Tahun"
              {...registerGoal('name')}
            />
            {goalErrors.name ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {goalErrors.name.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="goal-amount"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Nominal Target (Integer Rupiah)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-muted">
                Rp
              </span>
              <Input
                id="goal-amount"
                inputMode="numeric"
                disabled={isSubmittingGoal}
                value={rawTargetAmount}
                onChange={(e) => handleTargetAmountChange(e.target.value)}
                placeholder="Contoh: 15.000.000"
                className="pl-9 tabular-nums font-medium"
              />
            </div>
            {goalErrors.targetAmount ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {goalErrors.targetAmount.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="goal-date"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Target Tanggal Dicapai (Opsional)
              </label>
              <Input
                id="goal-date"
                type="date"
                disabled={isSubmittingGoal}
                {...registerGoal('targetDate')}
              />
            </div>

            <div>
              <label
                htmlFor="goal-wallet"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Rekening Penampung (Opsional)
              </label>
              <select
                id="goal-wallet"
                disabled={isSubmittingGoal}
                {...registerGoal('accountId')}
                className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <option value="">Tidak terhubung ke rekening spesifik</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatIDR(w.currentBalance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="goal-notes"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Catatan
            </label>
            <Input
              id="goal-notes"
              disabled={isSubmittingGoal}
              placeholder="Contoh: Simpan di rekening terpisah agar tidak terpakai"
              {...registerGoal('notes')}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmittingGoal}
              onClick={() => setGoalModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingGoal}
            >
              {isSubmittingGoal ? 'Menyimpan...' : 'Simpan Target'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Tambah Alokasi / Tarik Dana */}
      <Modal
        open={contribModalOpen}
        onClose={
          isSubmittingContrib ? () => undefined : () => setContribModalOpen(false)
        }
        title={
          contribType === 'deposit'
            ? 'Tambah Alokasi Tabungan'
            : 'Tarik Dana dari Tabungan'
        }
        description={`Mutasi untuk target: ${selectedGoal?.name ?? ''}`}
      >
        <form
          onSubmit={handleSubmitContrib(onValidSubmitContrib)}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="contrib-amount"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Nominal (Integer Rupiah)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-muted">
                Rp
              </span>
              <Input
                id="contrib-amount"
                inputMode="numeric"
                disabled={isSubmittingContrib}
                value={rawContribAmount}
                onChange={(e) => handleContribAmountChange(e.target.value)}
                placeholder="Contoh: 500.000"
                className="pl-9 tabular-nums font-medium"
              />
            </div>
            {contribErrors.amount ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {contribErrors.amount.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="contrib-date"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Tanggal Mutasi
              </label>
              <Input
                id="contrib-date"
                type="date"
                disabled={isSubmittingContrib}
                {...registerContrib('contributionDate')}
              />
            </div>

            <div>
              <label
                htmlFor="contrib-notes"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Catatan
              </label>
              <Input
                id="contrib-notes"
                disabled={isSubmittingContrib}
                placeholder="Contoh: Setoran awal bulan"
                {...registerContrib('notes')}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmittingContrib}
              onClick={() => setContribModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingContrib}
            >
              {isSubmittingContrib ? 'Menyimpan...' : 'Simpan Mutasi'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Dialog Konfirmasi Hapus Target */}
      <ConfirmDialog
        open={Boolean(deletingGoal)}
        onClose={() => setDeletingGoal(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Hapus Target Tabungan Ini?"
        description={`Target "${deletingGoal?.name ?? ''}" beserta riwayat alokasinya akan dihapus.`}
        confirmLabel="Ya, Hapus Target"
        variant="danger"
      />
    </div>
  );
}
