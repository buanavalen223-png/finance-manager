import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Layers, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export interface ModuleFoundationProps {
  title: string;
  subtitle: string;
  milestone: string;
  icon: LucideIcon;
  tableName: string;
  invariants: string[];
  plannedFeatures: string[];
}

export function ModuleFoundationView({
  title,
  subtitle,
  milestone,
  icon: Icon,
  tableName,
  invariants,
  plannedFeatures,
}: ModuleFoundationProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{title}</CardTitle>
                <Badge variant="brand">Target Implementasi: {milestone}</Badge>
              </div>
              <CardDescription className="mt-1 text-sm">{subtitle}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              Kembali ke Dashboard
            </Link>
            <Link
              to="/pengaturan"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand px-3.5 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
            >
              Status Koneksi
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 pt-5 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <Layers className="h-4 w-4 text-brand" aria-hidden="true" />
              <span>Cakupan Fungsional ({milestone})</span>
            </div>
            <ul className="space-y-2 text-sm text-foreground">
              {plannedFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-surface-muted/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <Shield className="h-4 w-4 text-brand" aria-hidden="true" />
                <span>Invariant & Keamanan Data</span>
              </div>
              <code className="rounded bg-surface px-2 py-0.5 text-xs font-medium text-brand">
                {tableName}
              </code>
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-muted">
              {invariants.map((rule) => (
                <li key={rule} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

