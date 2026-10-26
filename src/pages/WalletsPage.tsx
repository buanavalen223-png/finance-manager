import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  Coins,
  CreditCard,
  Pencil,
  Plus,
  ReceiptText,
  Smartphone,
  Wallet as WalletIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { WalletFormModal } from '@/components/features/wallets/WalletFormModal';
import { useAuth } from '@/hooks/useAuth';
import { addMoney, formatIDR } from '@/lib/currency';
import { formatDateID } from '@/lib/date';
import { computeTotalActiveBalance } from '@/lib/finance/ledger';
import {
  createWallet,
  fetchWallets,
  setWalletArchived,
  updateWallet,
} from '@/services/wallet.service';
import { fetchTransactions } from '@/services/transaction.service';
import { ensureDefaultCategories } from '@/services/category.service';
import type { WalletFormValues } from '@/schemas/wallet.schema';
import type {
  Account,
  AccountType,
  Category,
  Transaction,
} from '@/types/domain';

function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'bank':
      return 'Rekening Bank';
    case 'ewallet':
      return 'E-Wallet';
    case 'cash':
      return 'Kas Tunai';
    case 'investment':
      return 'Investasi';
    default:
      return 'Lainnya';
  }
}

function AccountTypeIcon({ type }: { type: AccountType }) {
  switch (type) {
    case 'bank':
      return <Building2 className="h-4 w-4" aria-hidden="true" />;
    case 'ewallet':
      return <Smartphone className="h-4 w-4" aria-hidden="true" />;
    case 'cash':
      return <Coins className="h-4 w-4" aria-hidden="true" />;
    default:
      return <CreditCard className="h-4 w-4" aria-hidden="true" />;
  }
}

export function WalletsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accountTransactions, setAccountTransactions] = useState<Transaction[]>(
    [],
  );
  const [showArchived, setShowArchived] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingTx, setIsLoadingTx] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Tambah/Edit & Konfirmasi Arsip
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingWallet, setEditingWallet] = useState<Account | null>(null);
  const [archivingWallet, setArchivingWallet] = useState<Account | null>(null);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  const loadWallets = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [loadedAccounts, loadedCategories] = await Promise.all([
        fetchWallets(user.id, { includeArchived: true }),
        ensureDefaultCategories(user.id),
      ]);
      setAccounts(loadedAccounts);
      setCategories(loadedCategories);

      const firstActive = loadedAccounts.find((a) => !a.isArchived);
      if (firstActive && !selectedAccountId) {
        setSelectedAccountId(firstActive.id);
      } else if (
        selectedAccountId &&
        !loadedAccounts.some((a) => a.id === selectedAccountId)
      ) {
        setSelectedAccountId(firstActive?.id ?? loadedAccounts[0]?.id ?? '');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal memuat daftar rekening & dompet.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedAccountId]);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  // Muat daftar transaksi per rekening terpilih
  useEffect(() => {
    if (!user || !selectedAccountId) {
      setAccountTransactions([]);
      return;
    }

    let isMounted = true;
    setIsLoadingTx(true);

    fetchTransactions(user.id, {
      accountId: selectedAccountId,
      page: 1,
      pageSize: 50,
    })
      .then((res) => {
        if (isMounted) {
          setAccountTransactions(res.items);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAccountTransactions([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingTx(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user, selectedAccountId]);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.isArchived),
    [accounts],
  );
  const archivedAccounts = useMemo(
    () => accounts.filter((a) => a.isArchived),
    [accounts],
  );
  const visibleAccounts = showArchived ? accounts : activeAccounts;

  const totalActiveBalance = useMemo(
    () => computeTotalActiveBalance(accounts),
    [accounts],
  );

  const totalAllBalance = useMemo(
    () => accounts.reduce((sum, a) => addMoney(sum, a.currentBalance), 0),
    [accounts],
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const openCreateModal = () => {
    setModalMode('create');
    setEditingWallet(null);
    setModalOpen(true);
  };

  const openEditModal = (wallet: Account) => {
    setModalMode('edit');
    setEditingWallet(wallet);
    setModalOpen(true);
  };

  const handleSubmitWallet = async (values: WalletFormValues) => {
    if (!user) return;
    if (modalMode === 'edit' && editingWallet) {
      const updated = await updateWallet(user.id, editingWallet.id, values);
      showToast({
        title: 'Rekening Diperbarui',
        description: `Rekening "${updated.name}" berhasil diperbarui.`,
        variant: 'success',
      });
    } else {
      const created = await createWallet(user.id, values);
      setSelectedAccountId(created.id);
      showToast({
        title: 'Rekening Baru Ditambahkan',
        description: `Rekening "${created.name}" dengan saldo awal ${formatIDR(created.initialBalance)} berhasil dibuat.`,
        variant: 'success',
      });
    }
    await loadWallets();
  };

  const handleConfirmToggleArchive = async () => {
    if (!user || !archivingWallet || isArchiving) return;
    setIsArchiving(true);
    try {
      const nextArchived = !archivingWallet.isArchived;
      const updated = await setWalletArchived(
        user.id,
        archivingWallet.id,
        nextArchived,
      );
      showToast({
        title: nextArchived ? 'Rekening Diarsipkan' : 'Rekening Dipulihkan',
        description: nextArchived
          ? `Rekening "${updated.name}" telah diarsipkan. Riwayat transaksinya tetap aman.`
          : `Rekening "${updated.name}" kembali aktif.`,
        variant: 'info',
      });
      setArchivingWallet(null);
      await loadWallets();
    } catch (err) {
      showToast({
        title: 'Gagal Mengubah Status Rekening',
        description:
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat mengarsipkan rekening.',
        variant: 'error',
      });
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Ringkasan Total Saldo Seluruh Rekening */}
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-5 shadow-subtle lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Rekening &amp; Dompet
            </h2>
            <Badge variant="brand">{activeAccounts.length} Aktif</Badge>
            {archivedAccounts.length > 0 ? (
              <Badge variant="default">{archivedAccounts.length} Arsip</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            Kelola rekening bank, e-wallet, dan kas tunai beserta daftar mutasi
            transaksi per rekening.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {archivedAccounts.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived((prev) => !prev)}
            >
              {showArchived
                ? 'Sembunyikan Rekening Arsip'
                : `Tampilkan Arsip (${archivedAccounts.length})`}
            </Button>
          ) : null}
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Tambah Rekening Baru
          </Button>
        </div>
      </section>

      {/* Kartu Total Saldo Seluruh Rekening */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-brand/25 sm:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Total Saldo Seluruh Rekening Aktif
            </CardDescription>
            <CardTitle className="tabular-nums text-3xl font-bold tracking-tight text-foreground">
              {formatIDR(totalActiveBalance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              Dihitung otomatis dari saldo awal dan mutasi buku besar pada{' '}
              <strong className="text-foreground">
                {activeAccounts.length} rekening aktif
              </strong>
              .
            </span>
            {archivedAccounts.length > 0 ? (
              <span>
                Termasuk arsip: <strong>{formatIDR(totalAllBalance)}</strong>
              </span>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Rekening Terpilih
            </CardDescription>
            <CardTitle className="truncate text-lg font-bold text-foreground">
              {selectedAccount ? selectedAccount.name : 'Belum dipilih'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted">
            {selectedAccount ? (
              <div className="flex items-center justify-between">
                <span>Saldo Awal:</span>
                <span className="tabular-nums font-semibold text-foreground">
                  {formatIDR(selectedAccount.initialBalance)}
                </span>
              </div>
            ) : (
              <span>Pilih kartu rekening untuk melihat mutasinya.</span>
            )}
          </CardContent>
        </Card>
      </section>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : errorMsg ? (
        <ErrorState
          title="Gagal Memuat Rekening"
          message={errorMsg}
          onRetry={() => void loadWallets()}
        />
      ) : visibleAccounts.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title="Belum Ada Rekening atau Dompet"
          description="Tambahkan rekening pertama Anda (Tunai, Bank, atau E-Wallet) beserta saldo awalnya untuk mulai mencatat transaksi."
          actionLabel="Tambah Rekening Pertama"
          onAction={openCreateModal}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Daftar Kartu Rekening */}
          <div className="space-y-3 lg:col-span-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Daftar Rekening ({visibleAccounts.length})
            </h3>
            {visibleAccounts.map((acc) => {
              const isSelected = acc.id === selectedAccountId;
              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedAccountId(acc.id);
                    }
                  }}
                  className={`cursor-pointer rounded-lg border p-4 transition-all ${
                    isSelected
                      ? 'border-brand bg-brand-soft/25 shadow-subtle'
                      : 'border-border bg-surface hover:border-brand/40'
                  } ${acc.isArchived ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white"
                        style={{ backgroundColor: acc.color || '#176B52' }}
                      >
                        <AccountTypeIcon type={acc.type} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {acc.name}
                          </p>
                          {acc.isArchived ? (
                            <Badge variant="default">Diarsipkan</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted">
                          {getAccountTypeLabel(acc.type)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openEditModal(acc)}
                        aria-label={`Edit rekening ${acc.name}`}
                        title="Edit rekening"
                        className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchivingWallet(acc)}
                        aria-label={
                          acc.isArchived
                            ? `Pulihkan rekening ${acc.name}`
                            : `Arsipkan rekening ${acc.name}`
                        }
                        title={
                          acc.isArchived
                            ? 'Pulihkan rekening'
                            : 'Arsipkan rekening'
                        }
                        className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                      >
                        {acc.isArchived ? (
                          <ArchiveRestore
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between border-t border-border/60 pt-3">
                    <div>
                      <span className="block text-[11px] text-muted">
                        Saldo Saat Ini
                      </span>
                      <span className="tabular-nums text-lg font-bold text-foreground">
                        {formatIDR(acc.currentBalance)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[11px] text-muted">
                        Saldo Awal
                      </span>
                      <span className="tabular-nums text-xs font-medium text-muted">
                        {formatIDR(acc.initialBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Daftar Transaksi per Rekening Terpilih */}
          <div className="lg:col-span-7">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>
                      Mutasi Rekening:{' '}
                      {selectedAccount ? selectedAccount.name : '-'}
                    </CardTitle>
                    <CardDescription>
                      Daftar pemasukan, pengeluaran, serta transfer masuk dan
                      keluar pada rekening ini.
                    </CardDescription>
                  </div>
                  {selectedAccount ? (
                    <Badge variant="brand">
                      Saldo: {formatIDR(selectedAccount.currentBalance)}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent>
                {isLoadingTx ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : accountTransactions.length === 0 ? (
                  <EmptyState
                    icon={ReceiptText}
                    title="Belum Ada Transaksi di Rekening Ini"
                    description="Transaksi pemasukan, pengeluaran, atau transfer yang melibatkan rekening ini akan muncul di sini."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {accountTransactions.map((tx) => {
                      const isIncomingTransfer =
                        tx.type === 'transfer' &&
                        tx.destinationAccountId === selectedAccountId;
                      const isPositiveForThisAccount =
                        tx.type === 'income' || isIncomingTransfer;

                      const sourceName =
                        accountMap.get(tx.accountId)?.name ?? 'Rekening';
                      const destName = tx.destinationAccountId
                        ? (accountMap.get(tx.destinationAccountId)?.name ??
                          'Tujuan')
                        : '';
                      const categoryName = tx.categoryId
                        ? (categoryMap.get(tx.categoryId)?.name ?? 'Kategori')
                        : 'Transfer Antar-Rekening';

                      return (
                        <li
                          key={tx.id}
                          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                                isPositiveForThisAccount
                                  ? 'bg-semantic-income-soft text-semantic-income'
                                  : 'bg-semantic-expense-soft text-semantic-expense'
                              }`}
                            >
                              {tx.type === 'transfer' ? (
                                <ArrowLeftRight
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ) : isPositiveForThisAccount ? (
                                <ArrowUpRight
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ArrowDownRight
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-foreground">
                                {tx.description}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted">
                                {tx.type === 'transfer'
                                  ? `${sourceName} → ${destName}`
                                  : categoryName}{' '}
                                &bull; {formatDateID(tx.transactionDate)}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`tabular-nums text-xs font-bold ${
                              isPositiveForThisAccount
                                ? 'text-semantic-income'
                                : 'text-semantic-expense'
                            }`}
                          >
                            {isPositiveForThisAccount
                              ? `+${formatIDR(tx.amount)}`
                              : `-${formatIDR(tx.amount)}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Rekening */}
      <WalletFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        initialWallet={editingWallet}
        onSubmitWallet={handleSubmitWallet}
      />

      {/* Dialog Konfirmasi Arsip / Pulihkan Rekening */}
      <ConfirmDialog
        open={Boolean(archivingWallet)}
        onClose={() => (isArchiving ? undefined : setArchivingWallet(null))}
        onConfirm={() => void handleConfirmToggleArchive()}
        title={
          archivingWallet?.isArchived
            ? 'Pulihkan Rekening Ini?'
            : 'Arsipkan Rekening Ini?'
        }
        description={
          archivingWallet
            ? archivingWallet.isArchived
              ? `Rekening "${archivingWallet.name}" akan kembali aktif dan dihitung dalam total saldo aktif.`
              : `Rekening "${archivingWallet.name}" akan disembunyikan dari pilihan transaksi baru. Seluruh riwayat transaksinya tetap tersimpan dengan aman.`
            : ''
        }
        confirmLabel={
          isArchiving
            ? 'Memproses...'
            : archivingWallet?.isArchived
              ? 'Ya, Pulihkan'
              : 'Ya, Arsipkan'
        }
        variant="primary"
      />
    </div>
  );
}
