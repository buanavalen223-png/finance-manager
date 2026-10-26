import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'brand' | 'income' | 'expense' | 'warning';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const badgeVariantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-muted text-muted border-border',
  brand: 'bg-brand-soft text-brand-soft-foreground border-transparent',
  income: 'bg-semantic-income-soft text-semantic-income border-transparent',
  expense: 'bg-semantic-expense-soft text-semantic-expense border-transparent',
  warning: 'bg-semantic-warning-soft text-semantic-warning border-transparent',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        badgeVariantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

