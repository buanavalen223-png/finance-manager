import {
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  Wallet,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { calculatePercentage, formatIDR } from '@/lib/currency';
import type { DemoWallet } from '@/fixtures/dashboardDemoData';

export interface SummaryMetricsGridProps {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  netCashflow: number;
  wallets: DemoWallet[];
}

export function SummaryMetricsGrid({
  totalBalance,
  monthlyIncome,
  monthlyExpense,
  netCashflow,
  wallets,
}: SummaryMetricsGridProps) {
  const savingsRate =
    monthlyIncome > 0
      ? calculatePercentage(Math.max(0, netCashflow), monthlyIncome)
      : 0;

  return (
    <section
      aria-label="Ringkasan metrik keuangan utama"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* 1. Total Saldo Rekening */}
      <Card className="border-brand/25">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="font-medium">
              Total Saldo Aktif
            </CardDescription>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground">
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="tabular-nums text-2xl font-bold tracking-tight">
            {formatIDR(totalBalance)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">
            Tersebar di{' '}
            <span className="font-medium text-foreground">
              {wallets.length} rekening &amp; dompet
            </span>
          </p>
        </CardContent>
      </Card>

      {/* 2. Pemasukan Bulan Ini */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="font-medium">
              Pemasukan Bulan Ini
            </CardDescription>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-semantic-income-soft text-semantic-income">
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="tabular-nums text-2xl font-bold tracking-tight text-semantic-income">
            {formatIDR(monthlyIncome, { showSign: true })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">
            Diluar mutasi transfer antar-rekening
          </p>
        </CardContent>
      </Card>

      {/* 3. Pengeluaran Bulan Ini */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="font-medium">
              Pengeluaran Bulan Ini
            </CardDescription>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-semantic-expense-soft text-semantic-expense">
              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="tabular-nums text-2xl font-bold tracking-tight text-semantic-expense">
            {formatIDR(monthlyExpense)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">
            Memperbarui realisasi anggaran aktif
          </p>
        </CardContent>
      </Card>

      {/* 4. Arus Kas Bersih (Net Cashflow) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="font-medium">
              Arus Kas Bersih
            </CardDescription>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-muted text-foreground">
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          <CardTitle
            className={`tabular-nums text-2xl font-bold tracking-tight ${
              netCashflow >= 0 ? 'text-foreground' : 'text-semantic-expense'
            }`}
          >
            {formatIDR(netCashflow, { showSign: netCashflow > 0 })}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">Rasio Surplus</span>
          <Badge variant={netCashflow >= 0 ? 'income' : 'expense'}>
            {netCashflow >= 0 ? `${savingsRate}% disimpan` : 'Defisit kas'}
          </Badge>
        </CardContent>
      </Card>
    </section>
  );
}

