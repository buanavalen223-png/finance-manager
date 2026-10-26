import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatIDR, parseIDRInput } from '@/lib/currency';
import { toISODateString } from '@/lib/date';
import {
  isoDateStringSchema,
  positiveRupiahSchema,
} from '@/schemas/common.schema';
import type {
  DemoCategory,
  DemoTransaction,
  DemoWallet,
} from '@/fixtures/dashboardDemoData';
import type { TransactionType } from '@/types/domain';

const quickTransactionSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: positiveRupiahSchema,
    walletId: z.string().min(1, 'Rekening/dompet wajib dipilih.'),
    destinationWalletId: z.string().optional(),
    categoryId: z.string().optional(),
    transactionDate: isoDateStringSchema,
    description: z
      .string()
      .trim()
      .min(2, 'Deskripsi minimal 2 karakter.')
      .max(100, 'Deskripsi maksimal 100 karakter.'),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'transfer') {
      if (!values.destinationWalletId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationWalletId'],
          message: 'Dompet tujuan wajib dipilih untuk transfer.',
        });
      } else if (values.destinationWalletId === values.walletId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationWalletId'],
          message: 'Dompet tujuan tidak boleh sama dengan dompet asal.',
        });
      }
    } else if (!values.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: 'Kategori wajib dipilih.',
      });
    }
  });

type QuickTransactionFormValues = z.infer<typeof quickTransactionSchema>;

export interface QuickActionModalProps {
  open: boolean;
  onClose: () => void;
  initialType: TransactionType;
  prefillDraft?: {
    type: TransactionType;
    amount: number;
    walletId: string;
    categoryId?: string;
    description: string;
  } | null;
  wallets: DemoWallet[];
  categories: DemoCategory[];
  onSubmitTransaction: (newTx: Omit<DemoTransaction, 'id'>) => void;
}

export function QuickActionModal({
  open,
  onClose,
  initialType,
  prefillDraft,
  wallets,
  categories,
  onSubmitTransaction,
}: QuickActionModalProps) {
  const [rawAmount, setRawAmount] = useState<string>('');

  const defaultIncomeCat =
    categories.find((c) => c.type === 'income')?.id ?? '';
  const defaultExpenseCat =
    categories.find((c) => c.type === 'expense')?.id ?? '';

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuickTransactionFormValues>({
    resolver: zodResolver(quickTransactionSchema),
    defaultValues: {
      type: initialType,
      amount: 0,
      walletId: wallets[0]?.id ?? '',
      destinationWalletId: wallets[1]?.id ?? '',
      categoryId:
        initialType === 'income' ? defaultIncomeCat : defaultExpenseCat,
      transactionDate: toISODateString(),
      description: '',
    },
  });

  const activeType = watch('type');

  useEffect(() => {
    if (!open) return;

    if (prefillDraft) {
      reset({
        type: prefillDraft.type,
        amount: prefillDraft.amount,
        walletId: prefillDraft.walletId,
        destinationWalletId: wallets[1]?.id ?? '',
        categoryId:
          prefillDraft.categoryId ??
          (prefillDraft.type === 'income' ? defaultIncomeCat : defaultExpenseCat),
        transactionDate: toISODateString(),
        description: prefillDraft.description,
      });
      setRawAmount(prefillDraft.amount.toLocaleString('id-ID'));
      return;
    }

    reset({
      type: initialType,
      amount: 0,
      walletId: wallets[0]?.id ?? '',
      destinationWalletId: wallets[1]?.id ?? '',
      categoryId:
        initialType === 'income' ? defaultIncomeCat : defaultExpenseCat,
      transactionDate: toISODateString(),
      description: '',
    });
    setRawAmount('');
  }, [
    open,
    initialType,
    prefillDraft,
    wallets,
    defaultIncomeCat,
    defaultExpenseCat,
    reset,
  ]);

  const availableCategories = categories.filter((c) =>
    activeType === 'income' ? c.type === 'income' : c.type === 'expense',
  );

  const handleAmountChange = (input: string) => {
    const parsed = parseIDRInput(input);
    setRawAmount(parsed > 0 ? parsed.toLocaleString('id-ID') : '');
    setValue('amount', parsed, { shouldValidate: true });
  };

  const handleTypeSwitch = (nextType: TransactionType) => {
    setValue('type', nextType, { shouldValidate: true });
    if (nextType === 'income') {
      setValue('categoryId', defaultIncomeCat);
    } else if (nextType === 'expense') {
      setValue('categoryId', defaultExpenseCat);
    }
  };

  const onValidSubmit = (values: QuickTransactionFormValues) => {
    onSubmitTransaction({
      type: values.type,
      amount: values.amount,
      walletId: values.walletId,
      destinationWalletId:
        values.type === 'transfer' ? values.destinationWalletId : undefined,
      categoryId:
        values.type === 'transfer' ? undefined : values.categoryId,
      transactionDate: values.transactionDate,
      description: values.description,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        prefillDraft
          ? 'Tinjau & Konfirmasi Draf Transaksi AI (Demo)'
          : 'Catat Transaksi Cepat (Demo)'
      }
      description={
        prefillDraft
          ? 'Periksa hasil ekstraksi kalimat alami sebelum menyimpannya ke buku besar demo.'
          : 'Mutasi akan langsung memperbarui saldo dompet dan metrik dashboard.'
      }
    >
      <form
        onSubmit={handleSubmit(onValidSubmit)}
        className="space-y-4"
        noValidate
      >
        {prefillDraft ? (
          <div className="rounded-md border border-brand/30 bg-brand-soft/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                Kalimat Input AI:
              </span>
              <Badge variant="brand">Wajib Konfirmasi</Badge>
            </div>
            <p className="mt-1 italic text-muted">
              &ldquo;Makan siang tim &amp; kopi 145.000 tadi siang pakai GoPay&rdquo;
            </p>
          </div>
        ) : null}

        {/* Pilihan Tipe Transaksi */}
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
            htmlFor="quick-amount"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Nominal Rupiah (Integer IDR)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-muted">
              Rp
            </span>
            <Input
              id="quick-amount"
              inputMode="numeric"
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

        {/* Pilihan Rekening / Dompet */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="quick-wallet"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              {activeType === 'transfer' ? 'Dari Rekening Asal' : 'Rekening / Dompet'}
            </label>
            <select
              id="quick-wallet"
              {...register('walletId')}
              className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({formatIDR(w.balance)})
                </option>
              ))}
            </select>
            {errors.walletId ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.walletId.message}
              </p>
            ) : null}
          </div>

          {activeType === 'transfer' ? (
            <div>
              <label
                htmlFor="quick-dest-wallet"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Ke Rekening Tujuan
              </label>
              <select
                id="quick-dest-wallet"
                {...register('destinationWalletId')}
                className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatIDR(w.balance)})
                  </option>
                ))}
              </select>
              {errors.destinationWalletId ? (
                <p className="mt-1 text-xs text-semantic-expense">
                  {errors.destinationWalletId.message}
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <label
                htmlFor="quick-category"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Kategori Transaksi
              </label>
              <select
                id="quick-category"
                {...register('categoryId')}
                className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId ? (
                <p className="mt-1 text-xs text-semantic-expense">
                  {errors.categoryId.message}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Tanggal & Deskripsi */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="quick-date"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Tanggal
            </label>
            <Input
              id="quick-date"
              type="date"
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
              htmlFor="quick-desc"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Deskripsi
            </label>
            <Input
              id="quick-desc"
              placeholder="Contoh: Belanja sayur & buah"
              {...register('description')}
            />
            {errors.description ? (
              <p className="mt-1 text-xs text-semantic-expense">
                {errors.description.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" size="sm">
            {prefillDraft ? 'Konfirmasi & Simpan Transaksi' : 'Simpan Transaksi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

