/** Indian 12-hour time display helper (en-IN). */

export function formatTime12h(hhmm: string): string {
  const parts = hhmm.split(':');
  if (parts.length < 2) return hhmm;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatClock12h(hour24: number, minute = 0): string {
  const d = new Date();
  d.setHours(((hour24 % 24) + 24) % 24, Math.min(59, Math.max(0, minute)), 0, 0);
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
