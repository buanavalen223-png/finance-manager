import { Link } from 'react-router-dom';
import { Bot, Sparkles } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { DemoAIInsight } from '@/fixtures/dashboardDemoData';

export interface AIInsightCardProps {
  insights: DemoAIInsight[];
  onSimulateAIDraft: () => void;
}

export function AIInsightCard({
  insights,
  onSimulateAIDraft,
}: AIInsightCardProps) {
  return (
    <Card className="border-brand/25 bg-surface">
      <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground">
            <Bot className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Finora AI Insight &amp; Draf Transaksi</CardTitle>
              <Badge variant="brand">Human-in-the-Loop</Badge>
            </div>
            <CardDescription className="mt-0.5">
              Ringkasan cerdas dari kondisi arus kas Anda. AI tidak pernah mengubah data
              tanpa konfirmasi eksplisit pengguna.
            </CardDescription>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onSimulateAIDraft}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Uji Draf Transaksi AI
          </Button>
          <Link
            to="/ai-assistant"
            className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Buka Asisten AI &rarr;
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-surface-muted/50 p-3.5"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {item.title}
                </span>
                <Badge
                  variant={
                    item.tone === 'positive'
                      ? 'income'
                      : item.tone === 'warning'
                        ? 'warning'
                        : 'default'
                  }
                >
                  {item.tag}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {item.summary}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

