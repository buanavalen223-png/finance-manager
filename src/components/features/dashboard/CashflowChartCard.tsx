import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatIDR } from '@/lib/currency';
import type { DemoCashflowPoint } from '@/fixtures/dashboardDemoData';

export interface CashflowChartCardProps {
  data: DemoCashflowPoint[];
  isDemo?: boolean;
}

function formatCompactMillions(value: number): string {
  if (value === 0) return 'Rp 0';
  const millions = value / 1000000;
  return `${millions.toFixed(millions % 1 === 0 ? 0 : 1)} jt`;
}

export function CashflowChartCard({
  data,
  isDemo = false,
}: CashflowChartCardProps) {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>Tren Arus Kas (6 Bulan)</CardTitle>
            {isDemo ? <Badge variant="default">Demo</Badge> : null}
          </div>
          <CardDescription className="mt-0.5">
            Perbandingan pemasukan dan pengeluaran riil tanpa transfer internal.
          </CardDescription>
        </div>

        {/* Legend Ringkas */}
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-brand"
              aria-hidden="true"
            />
            Pemasukan
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-semantic-expense/80"
              aria-hidden="true"
            />
            Pengeluaran
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-64 w-full" aria-label="Grafik batang arus kas 6 bulan">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              barGap={6}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border-subtle)"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCompactMillions}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: 'var(--bg-surface-muted)', opacity: 0.5 }}
                contentStyle={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
                formatter={(value: number, name: string) => [
                  formatIDR(value),
                  name === 'income' ? 'Pemasukan' : 'Pengeluaran',
                ]}
              />
              <Bar
                dataKey="income"
                name="income"
                fill="var(--brand-emerald)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="expense"
                name="expense"
                fill="var(--semantic-expense)"
                fillOpacity={0.82}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

