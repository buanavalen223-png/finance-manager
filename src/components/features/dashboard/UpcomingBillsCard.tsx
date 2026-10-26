import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Clock,
  HandCoins,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatIDR } from '@/lib/currency';
import { formatDateID } from '@/lib/date';
import type { UpcomingBillItem } from '@/lib/finance/planning';

export interface UpcomingBillsCardProps {
  items: UpcomingBillItem[];
  isDemo?: boolean;
}

export function UpcomingBillsCard({
  items,
  isDemo = false,
}: UpcomingBillsCardProps) {
  return (
    <Card className="flex flex-col justify-between border border-stone-200/80 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
      <CardHeader className="flex flex-row items-start justify-between gap-2 p-5 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Tagihan & Kewajiban Terdekat
            </CardTitle>
            {isDemo && <Badge variant="default">Demo</Badge>}
          </div>
          <CardDescription className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            Jadwal pengeluaran rutin dan jatuh tempo utang 7 hari ke depan.
          </CardDescription>
        </div>
        <Link
          to="/tagihan-berulang"
          className="shrink-0 text-xs font-medium text-finora-emerald underline-offset-4 hover:underline"
        >
          Lihat Semua &rarr;
        </Link>
      </CardHeader>

      <CardContent className="space-y-3 p-5 pt-0">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-stone-500 dark:text-stone-400">
            <CalendarClock className="mx-auto mb-2 h-7 w-7 text-stone-400" />
            Tidak ada tagihan atau utang yang jatuh tempo dalam 7 hari ke depan. Semua kewajiban terkendali!
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {items.slice(0, 5).map((item) => {
              return (
                <div
                  key={`${item.source}-${item.id}`}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        item.source === 'debt'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          : item.type === 'expense'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}
                    >
                      {item.source === 'debt' ? (
                        <HandCoins className="h-4 w-4" />
                      ) : item.type === 'expense' ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                        {item.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                        <span>{formatDateID(item.dueDate)}</span>
                        <span>•</span>
                        <span>
                          {item.source === 'debt' ? 'Utang/Piutang' : 'Tagihan Rutin'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xs font-bold ${
                        item.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-stone-900 dark:text-stone-100'
                      }`}
                    >
                      {formatIDR(item.amount)}
                    </div>
                    <div className="mt-0.5">
                      {item.status === 'overdue' ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                          <AlertCircle className="h-2.5 w-2.5" />
                          Terlambat
                        </span>
                      ) : item.status === 'due_today' ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <Clock className="h-2.5 w-2.5" />
                          Hari ini
                        </span>
                      ) : (
                        <span className="text-[10px] text-stone-500 dark:text-stone-400">
                          {item.daysDiff} hari lagi
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UpcomingBillsCard;
