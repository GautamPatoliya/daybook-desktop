'use client';

import './globals.css';
import './spider-verse.css';
import '../lib/bridge';
import PixelSkylineScene from '../components/PixelSkylineScene';
import SpiderVerseDecor from '../components/SpiderVerseDecor';
import ScreenWebDecor from '../components/spider/ScreenWebDecor';
import ActionCast from '../components/spider/ActionCast';
import { UpdateModal } from '../components/UpdateModal';
import { GlobalActionRouter } from '../components/GlobalActionRouter';
import { DialogProvider } from '../components/DialogProvider';
import BrandMark from '../components/BrandMark';
import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../lib/api';
import { Icon, I } from '../lib/icons';

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

  useEffect(() => {
    api.getSettings()
      .then((s) => {
        if (s?.theme) {
          document.documentElement.setAttribute('data-theme', s.theme);
          localStorage.setItem('daybook-theme', s.theme);
          if (typeof window !== 'undefined' && (window as any).wtt) {
            (window as any).wtt.invoke('app:setThemeIcon', s.theme).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('daybook-theme') || 'default';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <DialogProvider>
        {/* Pixel-art NYC skyline - only renders when spider-verse is active */}
        <PixelSkylineScene />

        <div className={`app-shell${hideChrome ? ' app-shell--onboarding' : ''}`}>
          <SpiderVerseDecor />
          {!hideChrome && (
            <header className="topbar">
              <div className="brand">
                <div className="brand-mark" aria-hidden>
                  <BrandMark size={40} />
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
          <div className="sv-stage">
            <ScreenWebDecor />
            {children}
          </div>
        </div>
        <ActionCast />
        <UpdateModal />
        <GlobalActionRouter />
        </DialogProvider>
      </body>
    </html>
  );
}
