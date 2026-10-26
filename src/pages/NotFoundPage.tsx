import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle className="text-lg">Halaman Tidak Ditemukan (404)</CardTitle>
          <CardDescription>
            Alamat URL yang Anda tuju tidak tersedia di dalam navigasi Finora AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to="/"
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            Kembali ke Dashboard Utama
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

