import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, type NavItem } from './navigation';
import { cn } from '@/lib/utils';

const SECTIONS: { key: NavItem['section']; title: string }[] = [
  { key: 'utama', title: 'Buku Besar' },
  { key: 'perencanaan', title: 'Perencanaan' },
  { key: 'inteligensi', title: 'Analitik & Sistem' },
];

export function Sidebar() {
  return (
    <aside
      aria-label="Navigasi utama desktop"
      className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col"
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-bold text-brand-foreground">
          F
        </div>
        <div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Finora AI
          </span>
          <span className="block text-[11px] text-muted">Personal Finance</span>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter((item) => item.section === section.key);
          return (
            <div key={section.key}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {section.title}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
                            isActive
                              ? 'bg-brand-soft text-brand-soft-foreground'
                              : 'text-muted hover:bg-surface-muted hover:text-foreground',
                          )
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="border-t border-border p-4">
        <div className="rounded-md bg-surface-muted px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between font-medium text-foreground">
            <span>Mata Uang Dasar</span>
            <span className="tabular-nums text-brand">IDR (Rp)</span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Presisi integer Rupiah &bull; Locale id-ID
          </p>
        </div>
      </div>
    </aside>
  );
}

