import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { addMoney, calculatePercentage, formatIDR } from '@/lib/currency';
import type {
  DemoBudget,
  DemoCategory,
  DemoTransaction,
} from '@/fixtures/dashboardDemoData';

export interface BudgetSummaryItem {
  id: string;
  categoryId: string | null;
  periodMonth: number;
  periodYear: number;
  amountLimit: number;
  alertThresholdPercent: number;
}

export interface BudgetSummaryCardProps {
  budgets: BudgetSummaryItem[] | DemoBudget[];
  categories: DemoCategory[];
  transactions: DemoTransaction[];
  isDemo?: boolean;
}

export function BudgetSummaryCard({
  budgets,
  categories,
  transactions,
  isDemo = false,
}: BudgetSummaryCardProps) {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const budgetRows = budgets.map((budget) => {
    const isOverall = !budget.categoryId;
    const spent = transactions
      .filter(
        (tx) =>
          tx.type === 'expense' &&
          (isOverall || tx.categoryId === budget.categoryId),
      )
      .reduce((acc, tx) => addMoney(acc, tx.amount), 0);

    const percent = calculatePercentage(spent, budget.amountLimit);
    const status: 'safe' | 'warning' | 'over' =
      percent >= 100
        ? 'over'
        : percent >= budget.alertThresholdPercent
          ? 'warning'
          : 'safe';

    return {
      ...budget,
      categoryName: isOverall
        ? 'Seluruh Pengeluaran'
        : categoryMap.get(budget.categoryId!) ?? 'Kategori',
      spent,
      percent,
      status,
    };
  });

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>Ringkasan Anggaran</CardTitle>
            {isDemo ? <Badge variant="default">Demo</Badge> : null}
          </div>
          <CardDescription className="mt-0.5">
            Pemantauan batas pengeluaran bulanan per kategori.
          </CardDescription>
        </div>
        <Link
          to="/anggaran"
          className="shrink-0 text-xs font-medium text-brand underline-offset-4 hover:underline"
        >
          Kelola &rarr;
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        {budgetRows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            Belum ada anggaran bulanan yang ditetapkan. Kelola batas pengeluaran
            di menu Anggaran.
          </p>
        ) : null}
        {budgetRows.map((row) => {
          const clampedBarWidth = Math.min(100, Math.max(0, row.percent));
          return (
            <div key={row.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {row.categoryName}
                  </span>
                  <Badge
                    variant={
                      row.status === 'over'
                        ? 'expense'
                        : row.status === 'warning'
                          ? 'warning'
                          : 'income'
                    }
                  >
                    {row.percent}%
                  </Badge>
                </div>
                <span className="tabular-nums text-muted">
                  <strong className="font-semibold text-foreground">
                    {formatIDR(row.spent)}
                  </strong>{' '}
                  / {formatIDR(row.amountLimit)}
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuenow={Math.round(row.percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Pemakaian anggaran ${row.categoryName}`}
                className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    row.status === 'over'
                      ? 'bg-semantic-expense'
                      : row.status === 'warning'
                        ? 'bg-semantic-warning'
                        : 'bg-brand'
                  }`}
                  style={{ width: `${clampedBarWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

