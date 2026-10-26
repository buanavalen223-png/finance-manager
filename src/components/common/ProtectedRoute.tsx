import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

export type RouteGuardDecision = 'allow' | 'loading' | 'redirect-login';

/**
 * Fungsi murni penentu akses ProtectedRoute (memudahkan pengujian unit
 * untuk skenario tanpa login vs sudah terautentikasi).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveProtectedRouteDecision(params: {
  isLoading: boolean;
  isAuthenticated: boolean;
}): RouteGuardDecision {
  if (params.isLoading) {
    return 'loading';
  }
  if (!params.isAuthenticated) {
    return 'redirect-login';
  }
  return 'allow';
}

export function ProtectedRoute() {
  const { isLoading, session, user } = useAuth();
  const location = useLocation();

  const decision = resolveProtectedRouteDecision({
    isLoading,
    isAuthenticated: Boolean(session && user),
  });

  if (decision === 'loading') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (decision === 'redirect-login') {
    return (
      <Navigate
        to="/auth/masuk"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}

