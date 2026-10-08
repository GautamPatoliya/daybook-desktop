'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const PENDING_KEY = 'daybook-pending-action';

/** Queue a board action and navigate home so Board can execute it. */
export function queueBoardAction(action: string, extra?: Record<string, string>) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ action, ...extra, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function consumeBoardAction(): { action: string; [k: string]: string } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as { action: string };
  } catch {
    return null;
  }
}

/**
 * Listens for tray IPC globally.
 * Always routes through Board (`/`) so actions work from Settings/Analytics/etc.
 */
export function GlobalActionRouter() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith('/onboarding')) return;

    function route(action: string, extra?: Record<string, string>) {
      queueBoardAction(action, extra);
      if (pathname === '/' || pathname === '') {
        // Board already mounted - fire a same-tab event
        window.dispatchEvent(new CustomEvent('daybook:pending-action'));
      } else {
        router.push('/');
      }
    }

    const offTray = window.wtt?.on('tray:action', (payload) => {
      const action = (payload as { action?: string })?.action;
      if (action) route(action);
    });

    return () => {
      offTray?.();
    };
  }, [pathname, router]);

  return null;
}
