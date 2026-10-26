import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { ConfigStatusBanner } from '@/components/common/ConfigStatusBanner';

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          <ConfigStatusBanner />
          <Outlet />
        </main>
        <MobileNav />
      </div>
    </div>
  );
}

