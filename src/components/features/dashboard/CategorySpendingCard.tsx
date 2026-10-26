import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { calculatePercentage, formatIDR } from '@/lib/currency';

export interface CategorySpendItem {
  categoryId: string;
  name: string;
  amount: number;
  color: string;
}

export interface CategorySpendingCardProps {
  items: CategorySpendItem[];
  totalExpense: number;
  onAddExpense?: () => void;
  isDemo?: boolean;
}

export function CategorySpendingCard({
  items,
  totalExpense,
  onAddExpense,
  isDemo = false,
}: CategorySpendingCardProps) {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Komposisi Pengeluaran</CardTitle>
          {isDemo ? <Badge variant="default">Demo</Badge> : null}
        </div>
        <CardDescription>
          Distribusi pengeluaran per kategori pada periode berjalan.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {items.length === 0 || totalExpense <= 0 ? (
          <EmptyState
            icon={PieChartIcon}
            title="Belum Ada Pengeluaran"
            description="Catat pengeluaran pertama Anda untuk melihat komposisi beban per kategori."
            actionLabel="Tambah Pengeluaran"
            onAction={onAddExpense}
          />
        ) : (
          <div className="space-y-4">
            <div
              className="mx-auto h-44 w-full max-w-[220px]"
              aria-label="Grafik lingkaran pengeluaran per kategori"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={74}
                    paddingAngle={2}
                    stroke="var(--bg-surface)"
                    strokeWidth={2}
                  >
                    {items.map((entry) => (
                      <Cell key={entry.categoryId} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                    }}
                    formatter={(value: number) => formatIDR(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ul className="divide-y divide-border text-xs">
              {items.slice(0, 5).map((item) => {
                const percent = calculatePercentage(item.amount, totalExpense);
                return (
                  <li
                    key={item.categoryId}
                    className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-medium text-foreground">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5 tabular-nums">
                      <span className="text-muted">{percent}%</span>
                      <span className="font-semibold text-foreground">
                        {formatIDR(item.amount)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

