import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatIDR, parseIDRInput } from '@/lib/currency';
import { toISODateString } from '@/lib/date';
import {
  transactionFormSchema,
  type TransactionFormValues,
} from '@/schemas/transaction.schema';
import type { CategoryFormValues } from '@/schemas/category.schema';
import type {
  Account,
  Category,
  Transaction,
  TransactionType,
} from '@/types/domain';

export interface TransactionFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialType?: TransactionType;
  initialTransaction?: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onSubmitTransaction: (values: TransactionFormValues) => Promise<void>;
  onQuickCreateCategory?: (
    values: CategoryFormValues,
  ) => Promise<Category | null>;
}

export function TransactionFormModal({
  open,
  onClose,
  mode,
  initialType = 'expense',
  initialTransaction = null,
  accounts,
  categories,
  onSubmitTransaction,
  onQuickCreateCategory,
}: TransactionFormModalProps) {
  const [rawAmount, setRawAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // State tambah kategori kustom cepat langsung dari dalam modal transaksi
  const [showInlineCategory, setShowInlineCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>('#176B52');
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);

  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          !acc.isArchived ||
          acc.id === initialTransaction?.accountId ||
          acc.id === initialTransaction?.destinationAccountId,
      ),
    [accounts, initialTransaction],
  );

  const defaultIncomeCat =
    categories.find((c) => c.type === 'income' && !c.isArchived)?.id ?? '';
  const defaultExpenseCat =
    categories.find((c) => c.type === 'expense' && !c.isArchived)?.id ?? '';

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: initialType,
      amount: 0,
      accountId: activeAccounts[0]?.id ?? '',
      destinationAccountId: activeAccounts[1]?.id ?? '',
      categoryId:
        initialType === 'income'
          ? defaultIncomeCat
          : initialType === 'expense'
            ? defaultExpenseCat
            : '',
      transactionDate: toISODateString(),
      description: '',
    },
  });

  const activeType = watch('type');
  const selectedAccountId = watch('accountId');

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setShowInlineCategory(false);
    setNewCategoryName('');

    if (mode === 'edit' && initialTransaction) {
      reset({
        type: initialTransaction.type,
        amount: initialTransaction.amount,
        accountId: initialTransaction.accountId,
        destinationAccountId:
          initialTransaction.destinationAccountId ??
          activeAccounts.find((a) => a.id !== initialTransaction.accountId)
            ?.id ??
          '',
        categoryId:
          initialTransaction.categoryId ??
          (initialTransaction.type === 'income'
            ? defaultIncomeCat
            : defaultExpenseCat),
        transactionDate: initialTransaction.transactionDate,
        description: initialTransaction.description,
      });
      setRawAmount(initialTransaction.amount.toLocaleString('id-ID'));
      return;
    }

    const firstAccId = activeAccounts[0]?.id ?? '';
    const secondAccId =
      activeAccounts.find((a) => a.id !== firstAccId)?.id ?? '';

    reset({
      type: initialType,
      amount: 0,
      accountId: firstAccId,
      destinationAccountId: secondAccId,
      categoryId:
        initialType === 'income'
          ? defaultIncomeCat
          : initialType === 'expense'
            ? defaultExpenseCat
            : '',
      transactionDate: toISODateString(),
      description: '',
    });
    setRawAmount('');
  }, [
    open,
    mode,
    initialType,
    initialTransaction,
    activeAccounts,
    defaultIncomeCat,
    defaultExpenseCat,
    reset,
  ]);

  const availableCategories = categories.filter((c) => {
    if (c.isArchived && c.id !== initialTransaction?.categoryId) return false;
    return activeType === 'income' ? c.type === 'income' : c.type === 'expense';
  });

  const handleAmountChange = (input: string) => {
    const parsed = parseIDRInput(input);
    setRawAmount(parsed > 0 ? parsed.toLocaleString('id-ID') : '');
    setValue('amount', parsed, { shouldValidate: true });
  };

  const handleTypeSwitch = (nextType: TransactionType) => {
    setValue('type', nextType, { shouldValidate: true });
    if (nextType === 'income') {
      setValue('categoryId', defaultIncomeCat, { shouldValidate: true });
    } else if (nextType === 'expense') {
      setValue('categoryId', defaultExpenseCat, { shouldValidate: true });
    } else {
      setValue('categoryId', '', { shouldValidate: false });
      const currentSource = watch('accountId');
      const altDest =
        activeAccounts.find((a) => a.id !== currentSource)?.id ?? '';
      setValue('destinationAccountId', altDest, { shouldValidate: true });
    }
  };

  const handleCreateCustomCategory = async () => {
    if (!onQuickCreateCategory || activeType === 'transfer') return;
    if (newCategoryName.trim().length < 2) {
      setSubmitError('Nama kategori kustom minimal 2 karakter.');
      return;
    }
    setIsCreatingCategory(true);
    setSubmitError(null);
    try {
      const created = await onQuickCreateCategory({
        name: newCategoryName.trim(),
        type: activeType,
        color: newCategoryColor,
        icon: 'tag',
      });
      if (created) {
        setValue('categoryId', created.id, { shouldValidate: true });
        setNewCategoryName('');
        setShowInlineCategory(false);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Gagal membuat kategori kustom.',
      );
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const onValidSubmit = async (values: TransactionFormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitTransaction(values);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menyimpan transaksi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => undefined : onClose}
      title={
        mode === 'edit'
          ? 'Edit Transaksi Buku Besar'
          : 'Catat Transaksi Baru'
      }
      description={
        mode === 'edit'
          ? 'Perubahan nominal, rekening, atau jenis transaksi akan menyesuaikan saldo rekening secara otomatis dan konsisten.'
          : 'Catat pemasukan, pengeluaran, atau transfer antar-rekening dalam satuan integer Rupiah.'
      }
    >
      <form
        onSubmit={handleSubmit(onValidSubmit)}
        className="space-y-4"
        noValidate
      >
        {submitError ? (
          <div
            role="alert"
            className="rounded-md border border-semantic-expense/40 bg-semantic-expense-soft px-3 py-2 text-xs text-semantic-expense"
          >
            {submitError}
          </div>
        ) : null}

        {/* Pilihan Jenis Transaksi */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            Jenis Transaksi
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: 'expense', label: 'Pengeluaran' },
                { value: 'income', label: 'Pemasukan' },
                { value: 'transfer', label: 'Transfer' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleTypeSwitch(item.value)}
                className={`h-9 rounded-md border text-xs font-medium transition-colors ${
                  activeType === item.value
                    ? 'border-brand bg-brand-soft text-brand-soft-foreground'
                    : 'border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Nominal IDR */}
        <div>
          <label
            htmlFor="tx-form-amount"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Nominal Rupiah (Integer IDR)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-muted">
              Rp
            </span>
            <Input
              id="tx-form-amount"
              inputMode="numeric"
              disabled={isSubmitting}
              value={rawAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="Contoh: 150.000"
              className="pl-9 tabular-nums font-medium"
            />
          </div>
          {errors.amount ? (
            <p className="mt-1 text-xs text-semantic-expense">
              {errors.amount.message}
            </p>
          ) : null}
        </div>

        {/* Pilihan Rekening & Kategori / Rekening Tujuan */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="tx-form-account"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              {activeType === 'transfer' ? 'Dari Rekening Sumber' : 'Rekening / Dompet'}
            </label>
            <select
              id="tx-form-account"
              disabled={isSubmitting}
              {...register('accountId')}
              className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {activeAccounts.length === 0 ? (
                <option value="">Belum ada rekening aktif</option>
              ) : (
                activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatIDR(acc.currentBalance)})
                  </option>
                ))
              )}
            </select>
            {errors.accountId ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.accountId.message}
              </p>
            ) : null}
          </div>

          {activeType === 'transfer' ? (
            <div>
              <label
                htmlFor="tx-form-dest-account"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Ke Rekening Tujuan
              </label>
              <select
                id="tx-form-dest-account"
                disabled={isSubmitting}
                {...register('destinationAccountId')}
                className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <option value="">Pilih rekening tujuan...</option>
                {activeAccounts.map((acc) => (
                  <option
                    key={acc.id}
                    value={acc.id}
                    disabled={acc.id === selectedAccountId}
                  >
                    {acc.name} ({formatIDR(acc.currentBalance)})
                    {acc.id === selectedAccountId ? ' — Rekening Sumber' : ''}
                  </option>
                ))}
              </select>
              {errors.destinationAccountId ? (
                <p className="mt-1 text-xs text-semantic-expense">
                  {errors.destinationAccountId.message}
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="tx-form-category"
                  className="text-xs font-medium text-foreground"
                >
                  Kategori ({activeType === 'income' ? 'Pemasukan' : 'Pengeluaran'})
                </label>
                {onQuickCreateCategory ? (
                  <button
                    type="button"
                    onClick={() => setShowInlineCategory((prev) => !prev)}
                    className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand hover:underline"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    Kategori Kustom
                  </button>
                ) : null}
              </div>
              <select
                id="tx-form-category"
                disabled={isSubmitting}
                {...register('categoryId')}
                className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {availableCategories.length === 0 ? (
                  <option value="">Pilih kategori...</option>
                ) : (
                  availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.isSystem ? '(Default)' : '(Kustom)'}
                    </option>
                  ))
                )}
              </select>
              {errors.categoryId ? (
                <p className="mt-1 text-xs text-semantic-expense">
                  {errors.categoryId.message}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Form Inline Pembuatan Kategori Kustom Cepat */}
        {showInlineCategory && activeType !== 'transfer' ? (
          <div className="rounded-md border border-border bg-surface-muted/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Tambah Kategori Kustom Baru
              </span>
              <Badge variant="brand">
                {activeType === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nama kategori kustom..."
                className="h-8 flex-1 text-xs"
              />
              <input
                type="color"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                aria-label="Warna kategori"
                className="h-8 w-10 cursor-pointer rounded border border-border bg-surface p-0.5"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isCreatingCategory}
                onClick={() => void handleCreateCustomCategory()}
              >
                {isCreatingCategory ? 'Menyimpan...' : 'Simpan Kategori'}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Tanggal & Catatan Transaksi */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="tx-form-date"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Tanggal Transaksi
            </label>
            <Input
              id="tx-form-date"
              type="date"
              disabled={isSubmitting}
              {...register('transactionDate')}
              className="text-xs"
            />
            {errors.transactionDate ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.transactionDate.message}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="tx-form-desc"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Catatan / Deskripsi
            </label>
            <Input
              id="tx-form-desc"
              disabled={isSubmitting}
              placeholder="Contoh: Makan siang, Gaji bulanan, atau Transfer tabungan"
              {...register('description')}
            />
            {errors.description ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.description.message}
              </p>
            ) : null}
          </div>
        </div>

        {activeType === 'transfer' ? (
          <p className="rounded-md bg-surface-muted px-3 py-2 text-[11px] text-muted">
            <strong>Aturan Transfer:</strong> Dana akan dikurangi dari rekening sumber
            dan ditambahkan ke rekening tujuan secara atomik. Mutasi transfer tidak
            dihitung sebagai pemasukan maupun pengeluaran dalam laporan agregat.
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting || activeAccounts.length === 0}
          >
            {isSubmitting
              ? 'Menyimpan...'
              : mode === 'edit'
                ? 'Simpan Perubahan'
                : 'Simpan Transaksi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
