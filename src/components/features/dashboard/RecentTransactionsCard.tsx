import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Pencil,
  ReceiptText,
  Trash2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { formatIDR } from '@/lib/currency';
import { formatDateID } from '@/lib/date';
import type {
  DemoCategory,
  DemoTransaction,
  DemoWallet,
} from '@/fixtures/dashboardDemoData';
import type { TransactionType } from '@/types/domain';

export interface RecentTransactionsCardProps {
  transactions: DemoTransaction[];
  wallets: DemoWallet[];
  categories: DemoCategory[];
  onRequestDelete: (transaction: DemoTransaction) => void;
  onRequestEdit?: (transaction: DemoTransaction) => void;
  onRequestCreate: (type: TransactionType) => void;
  isDemo?: boolean;
}

type FilterTab = 'all' | TransactionType;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

export function RecentTransactionsCard({
  transactions,
  wallets,
  categories,
  onRequestDelete,
  onRequestEdit,
  onRequestCreate,
  isDemo = false,
}: RecentTransactionsCardProps) {
  const [filter, setFilter] = useState<FilterTab>('all');

  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const filteredTransactions =
    filter === 'all'
      ? transactions
      : transactions.filter((tx) => tx.type === filter);

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Transaksi Terbaru</CardTitle>
              {isDemo ? <Badge variant="default">Demo</Badge> : null}
            </div>
            <CardDescription className="mt-0.5">
              Mutasi terkini pada buku besar beserta rekonsiliasi saldo.
            </CardDescription>
          </div>
          <Link
            to="/transaksi"
            className="text-xs font-medium text-brand underline-offset-4 hover:underline"
          >
            Buku Besar &rarr;
          </Link>
        </div>

        {/* Filter Pills */}
        <div
          role="tablist"
          aria-label="Filter tipe transaksi"
          className="flex flex-wrap gap-1.5"
        >
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-brand text-brand-foreground'
                    : 'bg-surface-muted text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {filteredTransactions.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Belum Ada Transaksi pada Filter Ini"
            description="Catat pemasukan, pengeluaran, atau transfer baru melalui tombol aksi cepat."
            actionLabel="Catat Transaksi"
            onAction={() => onRequestCreate(filter === 'all' ? 'expense' : filter)}
          />
        ) : (
          <ul className="divide-y divide-border">
            {filteredTransactions.slice(0, 6).map((tx) => {
              const sourceWalletName = walletMap.get(tx.walletId) ?? 'Dompet';
              const destWalletName = tx.destinationWalletId
                ? walletMap.get(tx.destinationWalletId)
                : undefined;
              const categoryName = tx.categoryId
                ? categoryMap.get(tx.categoryId)
                : 'Transfer Internal';

              return (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
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
                      <p className="truncate text-sm font-medium text-foreground">
                        {tx.description}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                        <span>{categoryName}</span>
                        <span>&bull;</span>
                        <span className="truncate">
                          {tx.type === 'transfer' && destWalletName
                            ? `${sourceWalletName} → ${destWalletName}`
                            : sourceWalletName}
                        </span>
                        <span>&bull;</span>
                        <span>{formatDateID(tx.transactionDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`tabular-nums text-sm font-semibold ${
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

                    {onRequestEdit ? (
                      <button
                        type="button"
                        onClick={() => onRequestEdit(tx)}
                        aria-label={`Edit transaksi ${tx.description}`}
                        title="Edit transaksi"
                        className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onRequestDelete(tx)}
                      aria-label={`Hapus transaksi ${tx.description}`}
                      title="Hapus transaksi & kembalikan saldo"
                      className="rounded-md p-1.5 text-muted transition-colors hover:bg-semantic-expense-soft hover:text-semantic-expense"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

