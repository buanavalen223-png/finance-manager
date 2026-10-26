import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Gagal Memuat Komponen Data',
  message,
  code,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start justify-between gap-4 rounded-lg border border-semantic-expense/30 bg-surface p-5 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-semantic-expense-soft text-semantic-expense">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {code ? (
              <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted">
                {code}
              </code>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{message}</p>
        </div>
      </div>

      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Pulihkan Tampilan
        </Button>
      ) : null}
    </div>
  );
}

