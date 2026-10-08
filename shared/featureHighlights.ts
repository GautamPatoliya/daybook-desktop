/**
 * Time-boxed “New” badges for shipped UI surfaces.
 * Clock starts on first eligible launch (persisted in settings), then auto-hides after ttlDays.
 * Add entries here when introducing a highlight — do not hardcode one-off UI timers in pages.
 */

export type FeatureHighlightId = 'settings-email-tab' | 'settings-projects-tab';

export type FeatureHighlightDef = {
  /** Short chip label (shown uppercase in UI). */
  label: string;
  /** Auto-hide after this many days from first eligible launch. */
  ttlDays: number;
};

export const FEATURE_HIGHLIGHTS: Record<FeatureHighlightId, FeatureHighlightDef> = {
  'settings-email-tab': {
    label: 'New',
    ttlDays: 3,
  },
  'settings-projects-tab': {
    label: 'Updated',
    ttlDays: 3,
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function isFeatureHighlightActive(
  id: FeatureHighlightId,
  starts: Record<string, string> | undefined,
  nowMs = Date.now(),
): boolean {
  const def = FEATURE_HIGHLIGHTS[id];
  if (!def) return false;
  const startIso = starts?.[id];
  if (!startIso) return true; // visible until start is seeded
  const start = Date.parse(startIso);
  if (Number.isNaN(start)) return false;
  return nowMs - start < def.ttlDays * DAY_MS;
}

/** Seed start timestamp once; returns whether settings need a write. */
export function ensureFeatureHighlightStart(
  id: FeatureHighlightId,
  starts: Record<string, string> | undefined,
  now = new Date(),
): { starts: Record<string, string>; seeded: boolean } {
  const current = starts && typeof starts === 'object' ? { ...starts } : {};
  if (current[id]) return { starts: current, seeded: false };
  current[id] = now.toISOString();
  return { starts: current, seeded: true };
}

/** Seed multiple highlight clocks in one pass. */
export function ensureFeatureHighlightStarts(
  ids: FeatureHighlightId[],
  starts: Record<string, string> | undefined,
  now = new Date(),
): { starts: Record<string, string>; seeded: boolean } {
  let current = starts && typeof starts === 'object' ? { ...starts } : {};
  let seeded = false;
  for (const id of ids) {
    const next = ensureFeatureHighlightStart(id, current, now);
    current = next.starts;
    if (next.seeded) seeded = true;
  }
  return { starts: current, seeded };
}

export function normalizeFeatureHighlightStarts(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    if (Number.isNaN(Date.parse(value))) continue;
    out[key] = value;
  }
  return out;
}
