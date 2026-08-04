'use client';

import './globals.css';
import '../lib/bridge';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';
import { I } from '../lib/icons';

const LINKS = [
  { href: '/', label: 'Board', icon: I.list },
  { href: '/projects/', label: 'Projects', icon: I.projects },
  { href: '/analytics/', label: 'Analytics', icon: I.chart },
  { href: '/models/', label: 'Local AI', icon: I.cpu },
  { href: '/settings/', label: 'Settings', icon: I.settings },
  { href: '/updates/', label: 'Updates', icon: I.refresh },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname?.startsWith('/onboarding');

  return (
    <html lang="en">
      <body>
        <div className={`app-shell${hideChrome ? ' app-shell--onboarding' : ''}`}>
          {!hideChrome && (
            <header className="topbar">
              <div className="brand">
                <div className="brand-mark" aria-hidden>
                  <Icon icon={I.logo} width={18} />
                </div>
                <div>
                  <div className="brand-name">Daybook</div>
                </div>
              </div>
              <nav className="nav-links" aria-label="Main">
                {LINKS.map((l) => {
                  const active =
                    pathname === l.href ||
                    (l.href !== '/' && pathname?.startsWith(l.href.replace(/\/$/, '')));
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`nav-link${active ? ' active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon icon={l.icon} width={15} />
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
            </header>
          )}
          {children}
        </div>
      </body>
    </html>
  );
}
