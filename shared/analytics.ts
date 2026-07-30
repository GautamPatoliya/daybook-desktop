import fs from 'node:fs';
import path from 'node:path';
import type { AnalyticsSummary, TaskStore } from './types';
import { DataRoot, listExistingDates, readStore } from './store';

function dayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function computeAnalytics(root: DataRoot, lastNDays = 30): AnalyticsSummary {
  const dates = listExistingDates(root).slice(-lastNDays);
  let totalTasks = 0;
  let done = 0;
  let wip = 0;
  let none = 0;
  let carryOverCount = 0;
  let wipAgeSum = 0;
  let wipAgeCount = 0;
  const byProject: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byWeekday: Record<string, number> = {};
  const activityByHour: Record<string, number> = {};
  const recentDays: AnalyticsSummary['recentDays'] = [];

  for (const date of dates) {
    const store: TaskStore = readStore(root, date);
    const dayDone = store.tasks.filter((t) => t.status === 'done').length;
    const dayWip = store.tasks.filter((t) => t.status === 'wip').length;
    const dayNone = store.tasks.filter((t) => t.status === 'none').length;
    totalTasks += store.tasks.length;
    done += dayDone;
    wip += dayWip;
    none += dayNone;
    carryOverCount += store.tasks.filter((t) => Boolean(t.carriedFrom)).length;
    recentDays.push({ date, total: store.tasks.length, done: dayDone, wip: dayWip, none: dayNone });

    const [y, m, d] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    });
    byWeekday[weekday] = (byWeekday[weekday] || 0) + store.tasks.length;

    for (const t of store.tasks) {
      byProject[t.project] = (byProject[t.project] || 0) + 1;
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      const hour = (t.createdAt || '00:00').slice(0, 2);
      activityByHour[hour] = (activityByHour[hour] || 0) + 1;
      if ((t.status === 'wip' || t.status === 'none') && t.carriedFrom) {
        wipAgeSum += dayDiff(t.carriedFrom, date);
        wipAgeCount += 1;
      }
    }
  }

  // Streak: consecutive calendar days ending at latest date with >=1 task
  let streakDays = 0;
  const sorted = [...dates].sort().reverse();
  if (sorted.length) {
    let cursor = sorted[0];
    const set = new Set(dates);
    while (set.has(cursor)) {
      const store = readStore(root, cursor);
      if (!store.tasks.length) break;
      streakDays += 1;
      const [y, m, d] = cursor.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - 1);
      cursor = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    }
  }

  return {
    daysWithData: dates.length,
    totalTasks,
    done,
    wip,
    none,
    completionRate: totalTasks ? Math.round((done / totalTasks) * 1000) / 10 : 0,
    carryOverCount,
    streakDays,
    averageWipAgeDays: wipAgeCount ? Math.round((wipAgeSum / wipAgeCount) * 10) / 10 : 0,
    byProject,
    byCategory,
    byWeekday,
    activityByHour,
    recentDays,
  };
}

export function analyticsToCsv(summary: AnalyticsSummary): string {
  const lines = ['date,total,done,wip,none'];
  for (const d of summary.recentDays) {
    lines.push(`${d.date},${d.total},${d.done},${d.wip},${d.none}`);
  }
  lines.push('');
  lines.push('project,count');
  for (const [k, v] of Object.entries(summary.byProject)) lines.push(`"${k.replace(/"/g, '""')}",${v}`);
  lines.push('');
  lines.push('category,count');
  for (const [k, v] of Object.entries(summary.byCategory)) lines.push(`"${k.replace(/"/g, '""')}",${v}`);
  return lines.join('\n');
}

export function writeEmailArtifacts(
  root: DataRoot,
  date: string,
  draft: { subject: string; body: string; htmlBody: string },
) {
  const dir = path.join(root.dataDir, date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'email-draft.md'), `Subject: ${draft.subject}\n\n${draft.body}\n`, 'utf8');
  fs.writeFileSync(path.join(dir, 'email-body.txt'), draft.body, 'utf8');
  fs.writeFileSync(path.join(dir, 'email-body.html'), draft.htmlBody, 'utf8');
}
