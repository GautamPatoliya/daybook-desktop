import fs from 'node:fs';
import path from 'node:path';
import type { AnalyticsRange, AnalyticsSummary, Task, TaskStore } from './types';
import { DataRoot, listExistingDates, readStore } from './store';
import {
  formatAnalyticsDateSpan,
  formatAnalyticsPeriodLabel,
} from './analyticsFormat';

export type { AnalyticsRange };
export {
  analyticsRangePrefix,
  formatAnalyticsDateSpan,
  formatAnalyticsDay,
  formatAnalyticsFilenameSpan,
  formatAnalyticsPeriodLabel,
} from './analyticsFormat';

export type AnalyticsTaskRow = {
  date: string;
  title: string;
  project: string;
  category: string;
  status: TaskStatusLabel;
  priority: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
  progress: ProgressLabel;
  carriedFrom: string;
  details: string;
};

type TaskStatusLabel = 'Done' | 'In Progress' | 'Backlog';
type ProgressLabel = 'Completed' | 'Still running' | 'Not started';

function statusLabel(status: string): TaskStatusLabel {
  if (status === 'done') return 'Done';
  if (status === 'wip') return 'In Progress';
  return 'Backlog';
}

function progressLabel(status: string): ProgressLabel {
  if (status === 'done') return 'Completed';
  if (status === 'wip') return 'Still running';
  return 'Not started';
}

/** Flatten TipTap/HTML details to a short plain note for managers. */
function detailsPlain(html?: string): string {
  if (!html?.trim()) return '';
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function dayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function toIsoUtc(dt: Date): string {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Monday-start week in UTC calendar (good enough for local day files keyed YYYY-MM-DD). */
export function resolveAnalyticsWindow(
  range: AnalyticsRange,
  allDates: string[],
): { from: string; to: string; dates: string[] } {
  if (!allDates.length) return { from: '', to: '', dates: [] };
  const to = allDates[allDates.length - 1];
  const [ty, tm, td] = to.split('-').map(Number);
  const end = new Date(Date.UTC(ty, tm - 1, td));

  if (range === 'week') {
    // Monday = 1 … Sunday = 0 → days since Monday
    const dow = end.getUTCDay();
    const sinceMon = dow === 0 ? 6 : dow - 1;
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - sinceMon);
    const from = toIsoUtc(start);
    const dates = allDates.filter((d) => d >= from && d <= to);
    return { from, to, dates };
  }

  const n = range === '7' ? 7 : range === '90' ? 90 : 30;
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (n - 1));
  const from = toIsoUtc(start);
  const dates = allDates.filter((d) => d >= from && d <= to);
  return { from, to, dates };
}

export function computeAnalytics(root: DataRoot, range: AnalyticsRange = '30'): AnalyticsSummary {
  const allDates = listExistingDates(root);
  const { from, to, dates } = resolveAnalyticsWindow(range, allDates);

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
      cursor = toIsoUtc(dt);
    }
  }

  return {
    daysWithData: recentDays.filter((d) => d.total > 0).length,
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
    rangeFrom: from,
    rangeTo: to,
    range,
  };
}

function csvEscape(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function collectTasksInRange(root: DataRoot, dates: string[]): AnalyticsTaskRow[] {
  const rows: AnalyticsTaskRow[] = [];
  for (const date of dates) {
    const store: TaskStore = readStore(root, date);
    for (const t of store.tasks as Task[]) {
      const created = t.createdAt || '';
      const updated = t.updatedAt || '';
      rows.push({
        date,
        title: t.title || '',
        project: t.project || '',
        category: t.category || '',
        status: statusLabel(t.status),
        priority: t.priority || '',
        createdAt: created,
        updatedAt: updated,
        completedAt: t.status === 'done' ? updated : '',
        progress: progressLabel(t.status),
        carriedFrom: t.carriedFrom || '',
        details: detailsPlain(t.detailsHtml),
      });
    }
  }
  // Newest work first within the report
  rows.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
  });
  return rows;
}

/** Manager-ready task report (Excel-friendly UTF-8 BOM). */
export function analyticsToCsv(
  summary: AnalyticsSummary,
  taskRows: AnalyticsTaskRow[] = [],
): string {
  const lines: string[] = [];
  const periodLabel = formatAnalyticsPeriodLabel(
    summary.range,
    summary.rangeFrom || '',
    summary.rangeTo || '',
  );
  const span = formatAnalyticsDateSpan(summary.rangeFrom || '', summary.rangeTo || '');

  lines.push('Daybook Work Report');
  lines.push(`Period,${csvEscape(periodLabel)}`);
  lines.push(`Date range,${csvEscape(span)}`);
  lines.push(`From,${summary.rangeFrom || ''}`);
  lines.push(`To,${summary.rangeTo || ''}`);
  lines.push(`Generated,${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`);
  lines.push('');
  lines.push('Summary');
  lines.push(`Total tasks,${summary.totalTasks}`);
  lines.push(`Completed,${summary.done}`);
  lines.push(`Still in progress,${summary.wip}`);
  lines.push(`Backlog / not started,${summary.none}`);
  lines.push(`Completion rate %,${summary.completionRate}`);
  lines.push(`Active days,${summary.daysWithData}`);
  lines.push(`Carry-overs,${summary.carryOverCount}`);
  lines.push('');
  lines.push(
    [
      'Work Date',
      'Task',
      'Project',
      'Category',
      'Status',
      'Progress',
      'Priority',
      'Created Time',
      'Last Updated',
      'Completed Time',
      'Carried From',
      'Details',
    ].join(','),
  );
  for (const t of taskRows) {
    lines.push(
      [
        t.date,
        csvEscape(t.title),
        csvEscape(t.project),
        csvEscape(t.category),
        t.status,
        t.progress,
        t.priority,
        t.createdAt,
        t.updatedAt,
        t.completedAt,
        t.carriedFrom,
        csvEscape(t.details),
      ].join(','),
    );
  }
  if (!taskRows.length) {
    lines.push('(No tasks in this period)');
  }

  // BOM helps Excel on Windows open UTF-8 correctly
  return `\uFEFF${lines.join('\n')}`;
}

export function buildAnalyticsCsv(root: DataRoot, range: AnalyticsRange = '30'): string {
  const summary = computeAnalytics(root, range);
  const allDates = listExistingDates(root);
  const { dates } = resolveAnalyticsWindow(range, allDates);
  const tasks = collectTasksInRange(root, dates);
  return analyticsToCsv(summary, tasks);
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
