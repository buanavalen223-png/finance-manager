import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { parseIDRInput } from '@/lib/currency';
import {
  walletFormSchema,
  type WalletFormValues,
} from '@/schemas/wallet.schema';
import type { Account, AccountType } from '@/types/domain';

export interface WalletFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialWallet?: Account | null;
  onSubmitWallet: (values: WalletFormValues) => Promise<void>;
}

const WALLET_TYPE_OPTIONS: ReadonlyArray<{
  value: AccountType;
  label: string;
}> = [
  { value: 'bank', label: 'Bank (Rekening Tabungan / Giro)' },
  { value: 'ewallet', label: 'E-Wallet (GoPay, OVO, Dana, dll.)' },
  { value: 'cash', label: 'Tunai (Kas Dompet Harian)' },
  { value: 'other', label: 'Lainnya (Kartu / Instrumen Lain)' },
];

const WALLET_COLOR_PRESETS = [
  '#176B52',
  '#2E5A4C',
  '#2B8A6E',
  '#4E7D6E',
  '#3B6E5C',
  '#789E90',
];

export function WalletFormModal({
  open,
  onClose,
  mode,
  initialWallet = null,
  onSubmitWallet,
}: WalletFormModalProps) {
  const [rawInitialBalance, setRawInitialBalance] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: {
      name: '',
      type: 'bank',
      initialBalance: 0,
      color: '#176B52',
      icon: 'wallet',
    },
  });

  const selectedColor = watch('color');

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);

    if (mode === 'edit' && initialWallet) {
      reset({
        name: initialWallet.name,
        type: initialWallet.type,
        initialBalance: initialWallet.initialBalance,
        color: initialWallet.color || '#176B52',
        icon: initialWallet.icon || 'wallet',
      });
      setRawInitialBalance(
        initialWallet.initialBalance > 0
          ? initialWallet.initialBalance.toLocaleString('id-ID')
          : '0',
      );
      return;
    }

    reset({
      name: '',
      type: 'bank',
      initialBalance: 0,
      color: '#176B52',
      icon: 'wallet',
    });
    setRawInitialBalance('');
  }, [open, mode, initialWallet, reset]);

  const handleInitialBalanceChange = (input: string) => {
    const parsed = parseIDRInput(input);
    setRawInitialBalance(
      input.trim() === '' ? '' : parsed.toLocaleString('id-ID'),
    );
    setValue('initialBalance', parsed, { shouldValidate: true });
  };

  const onValidSubmit = async (values: WalletFormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitWallet(values);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan data rekening.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? () => undefined : onClose}
      title={mode === 'edit' ? 'Edit Rekening / Dompet' : 'Tambah Rekening Baru'}
      description={
        mode === 'edit'
          ? 'Perubahan saldo awal akan menyesuaikan saldo berjalan secara proporsional dengan tetap mempertahankan seluruh mutasi transaksi.'
          : 'Tambahkan rekening bank, e-wallet, kas tunai, atau instrumen penyimpanan lainnya.'
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

        {/* Nama Rekening */}
        <div>
          <label
            htmlFor="wallet-form-name"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Nama Rekening / Dompet
          </label>
          <Input
            id="wallet-form-name"
            disabled={isSubmitting}
            placeholder="Contoh: BCA Utama, GoPay Harian, atau Kas Tunai"
            {...register('name')}
          />
          {errors.name ? (
            <p className="mt-1 text-xs text-semantic-expense">
              {errors.name.message}
            </p>
          ) : null}
        </div>

        {/* Jenis Rekening */}
        <div>
          <label
            htmlFor="wallet-form-type"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Jenis Rekening
          </label>
          <select
            id="wallet-form-type"
            disabled={isSubmitting}
            {...register('type')}
            className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {WALLET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.type ? (
            <p className="mt-1 text-xs text-semantic-expense">
              {errors.type.message}
            </p>
          ) : null}
        </div>

        {/* Saldo Awal (Integer IDR) */}
        <div>
          <label
            htmlFor="wallet-form-initial-balance"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Saldo Awal (Integer Rupiah)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-muted">
              Rp
            </span>
            <Input
              id="wallet-form-initial-balance"
              inputMode="numeric"
              disabled={isSubmitting}
              value={rawInitialBalance}
              onChange={(e) => handleInitialBalanceChange(e.target.value)}
              placeholder="0"
              className="pl-9 tabular-nums font-medium"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Saldo berjalan dihitung otomatis dari Saldo Awal ditambah pemasukan,
            dikurangi pengeluaran, serta mutasi transfer masuk/keluar.
          </p>
          {errors.initialBalance ? (
            <p className="mt-1 text-xs text-semantic-expense">
              {errors.initialBalance.message}
            </p>
          ) : null}
        </div>

        {/* Warna Aksen Kartu Rekening */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            Warna Identitas Rekening
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {WALLET_COLOR_PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                disabled={isSubmitting}
                onClick={() => setValue('color', hex, { shouldValidate: true })}
                aria-label={`Pilih warna ${hex}`}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  selectedColor === hex
                    ? 'scale-110 border-foreground'
                    : 'border-transparent opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>

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
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Menyimpan...'
              : mode === 'edit'
                ? 'Simpan Perubahan'
                : 'Tambah Rekening'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

