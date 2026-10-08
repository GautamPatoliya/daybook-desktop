/**
 * Browser-safe analytics labels / date spans.
 * Keep this file free of Node builtins (`node:fs`, `node:crypto`, etc.) —
 * the Next.js renderer imports it directly.
 */
import type { AnalyticsRange } from './types';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function parseIsoParts(iso: string): { y: number; m: number; d: number } | null {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return { y: parts[0], m: parts[1], d: parts[2] };
}

/** e.g. `7 Apr 2026` or `7 Apr` when year omitted. */
export function formatAnalyticsDay(iso: string, withYear = true): string {
  const p = parseIsoParts(iso);
  if (!p) return iso;
  const mon = MONTHS_SHORT[p.m - 1] || String(p.m);
  return withYear ? `${p.d} ${mon} ${p.y}` : `${p.d} ${mon}`;
}

/** Smart span: `7–13 Apr 2026`, `28 Mar – 3 Apr 2026`, `30 Dec 2025 – 5 Jan 2026`. */
export function formatAnalyticsDateSpan(from: string, to: string): string {
  if (!from && !to) return '';
  if (!from) return formatAnalyticsDay(to);
  if (!to || from === to) return formatAnalyticsDay(from);
  const a = parseIsoParts(from);
  const b = parseIsoParts(to);
  if (!a || !b) return `${from} – ${to}`;
  if (a.y === b.y && a.m === b.m) {
    return `${a.d}–${b.d} ${MONTHS_SHORT[a.m - 1]} ${a.y}`;
  }
  if (a.y === b.y) {
    return `${a.d} ${MONTHS_SHORT[a.m - 1]} – ${b.d} ${MONTHS_SHORT[b.m - 1]} ${a.y}`;
  }
  return `${formatAnalyticsDay(from)} – ${formatAnalyticsDay(to)}`;
}

export function analyticsRangePrefix(range: AnalyticsRange): string {
  if (range === 'week') return 'This week';
  if (range === '7') return 'Last 7 days';
  if (range === '90') return 'Last 90 days';
  return 'Last 30 days';
}

/** e.g. `Last 7 days (7–13 Apr 2026)` */
export function formatAnalyticsPeriodLabel(
  range: AnalyticsRange,
  from: string,
  to: string,
): string {
  const prefix = analyticsRangePrefix(range);
  const span = formatAnalyticsDateSpan(from, to);
  return span ? `${prefix} (${span})` : prefix;
}

/** Safe filename fragment: `7Apr-13Apr-2026` */
export function formatAnalyticsFilenameSpan(from: string, to: string): string {
  const a = parseIsoParts(from);
  const b = parseIsoParts(to || from);
  if (!a || !b) return to || from || 'report';
  const am = MONTHS_SHORT[a.m - 1] || 'M';
  const bm = MONTHS_SHORT[b.m - 1] || 'M';
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d}${am}-${a.y}`;
  if (a.y === b.y) return `${a.d}${am}-${b.d}${bm}-${a.y}`;
  return `${a.d}${am}${a.y}-${b.d}${bm}${b.y}`;
}
