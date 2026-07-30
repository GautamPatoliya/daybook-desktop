import type { AppSettings } from '../../shared/types';
import { nowInTz } from '../../shared/store';

export type ReminderKind = 'hourly' | 'eod';

export function shouldFireReminder(
  settings: AppSettings,
  kind: ReminderKind,
  lastFiredKey: string | null,
): { fire: boolean; key: string } {
  const now = nowInTz(settings.timezone);
  const dow = now.getDay();
  if (!settings.workingDays.includes(dow)) {
    return { fire: false, key: lastFiredKey || '' };
  }

  const hour = now.getHours();
  const minute = now.getMinutes();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (kind === 'eod') {
    const key = `eod:${date}`;
    const due = hour > settings.eodHour || (hour === settings.eodHour && minute >= settings.eodMinute);
    return { fire: due && lastFiredKey !== key, key };
  }

  const { hourlyStart, hourlyEnd } = settings.popupHours;
  if (hour < hourlyStart || hour > hourlyEnd) {
    return { fire: false, key: lastFiredKey || '' };
  }
  const slot = Math.floor((hour * 60 + minute) / settings.reminderIntervalMinutes);
  const key = `hourly:${date}:${slot}`;
  return { fire: lastFiredKey !== key, key };
}
