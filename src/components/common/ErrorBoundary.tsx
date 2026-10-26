import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * ErrorBoundary tingkat aplikasi untuk menangkap kegagalan render tak terduga
 * tanpa menampilkan layar putih kosong kepada pengguna.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kesalahan saat memuat tampilan.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Finora AI ErrorBoundary]', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: null });
    window.location.assign('/');
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-card">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-semantic-expense-soft text-semantic-expense">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">
              Terjadi Gangguan pada Tampilan
            </h1>
            <p className="mt-2 text-sm text-muted">
              Sistem mendeteksi kendala teknis saat menampilkan halaman ini. Data keuangan Anda tetap aman.
            </p>
            {this.state.errorMessage ? (
              <pre className="mt-3 overflow-x-auto rounded-md bg-surface-muted p-3 text-xs text-muted">
                {this.state.errorMessage}
              </pre>
            ) : null}
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

