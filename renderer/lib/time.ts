/** Convert 0–23 hour to { hour12, minute, period } for pickers. */
export function hour24ToParts(hour24: number, minute = 0) {
  const h = ((hour24 % 24) + 24) % 24;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return { hour12, minute: Math.min(59, Math.max(0, minute)), period: period as 'AM' | 'PM' };
}

export function partsToHour24(hour12: number, period: 'AM' | 'PM'): number {
  const h = Math.min(12, Math.max(1, hour12));
  if (period === 'AM') return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

export function formatHourLabel(hour24: number): string {
  const { hour12, period } = hour24ToParts(hour24);
  return `${hour12}:00 ${period}`;
}

export function formatClock(hour24: number, minute: number): string {
  const { hour12, period } = hour24ToParts(hour24, minute);
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}
