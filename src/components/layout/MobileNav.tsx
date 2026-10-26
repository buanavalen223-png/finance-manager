import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { NAV_ITEMS } from './navigation';
import { cn } from '@/lib/utils';

const PRIMARY_MOBILE_PATHS = ['/', '/transaksi', '/dompet', '/ai-assistant'];

export function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const primaryItems = NAV_ITEMS.filter((item) =>
    PRIMARY_MOBILE_PATHS.includes(item.path),
  );

  return (
    <>
      {/* Bottom Navigation Bar for Mobile */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 py-1.5">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-brand' : 'text-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{item.label.split(' ')[0]}</span>
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-expanded={drawerOpen}
            aria-label="Buka menu modul lengkap"
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-colors',
              drawerOpen ? 'text-brand' : 'text-muted hover:text-foreground',
            )}
          >
            {drawerOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* Full Module Drawer for Mobile */}
      {drawerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu seluruh modul Finora AI"
          className="fixed inset-0 z-20 flex flex-col bg-background/95 pt-16 pb-20 backdrop-blur-sm lg:hidden"
        >
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Seluruh Modul Finora AI
              </p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-muted hover:text-foreground"
              >
                Tutup
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                        isActive
                          ? 'border-brand bg-brand-soft/60 text-foreground'
                          : 'border-border bg-surface text-foreground hover:bg-surface-muted',
                      )
                    }
                  >
                    <div className="mt-0.5 rounded-md bg-brand-soft p-2 text-brand-soft-foreground">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                        {item.shortDescription}
                      </p>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

