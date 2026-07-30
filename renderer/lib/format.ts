export function addDays(date: string, delta: number): string {
  const dt = parseIsoDate(date);
  dt.setDate(dt.getDate() + delta);
  return toIsoDate(dt);
}

export function formatDisplayDate(date: string): string {
  const dt = parseIsoDate(date);
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatShortDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [, m, d] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mIndex = Number(m) - 1;
  return `${Number(d)} ${months[mIndex] || m}`;
}

export function formatTime12h(hhmm: string): string {
  const parts = hhmm.split(':');
  if (parts.length < 2) return hhmm;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sameDay(a: string, b: string): boolean {
  return a === b;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function startOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
