'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Icon, I } from '../../lib/icons';
import SpideyLoader from '../../components/SpideyLoader';
import { Scrollbar } from '../../components/Scrollbar';
import { api } from '../../lib/api';
import {
  analyticsRangePrefix,
  formatAnalyticsDateSpan,
  formatAnalyticsDay,
  formatAnalyticsFilenameSpan,
  formatAnalyticsPeriodLabel,
} from '../../../shared/analyticsFormat';
import type { AnalyticsRange, AnalyticsSummary } from '../../../shared/types';

const RANGES: Array<{ id: AnalyticsRange; label: string }> = [
  { id: 'week', label: 'This week' },
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
];

const STATUS_COLORS = {
  done: '#22c55e',
  wip: '#3b82f6',
  none: '#94a3b8',
};

const CHART_COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#a78bfa', '#f472b6', '#38bdf8'];

const SV_STATUS_COLORS = {
  done: '#1a7fc4',
  wip: '#d4a017',
  none: '#6a88a8',
};

const SV_CHART_COLORS = ['#1a7fc4', '#7ecdb8', '#d4a017', '#df2a2f', '#4aa8e8', '#c9a84a'];

function useSpiderTheme() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () =>
      setOn(document.documentElement.getAttribute('data-theme') === 'spider-verse');
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return on;
}

function formatHourTick(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour > 12 ? `${hour - 12}p` : `${hour}a`;
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="an-metric">
      <span className="an-metric-label">{label}</span>
      <strong className="an-metric-value">{value}</strong>
      {hint ? <span className="an-metric-hint">{hint}</span> : null}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tooltip">
      {label != null && label !== '' ? <p className="an-tooltip-label">{label}</p> : null}
      {payload.map((p) => (
        <p key={`${p.name}-${p.value}`} className="an-tooltip-row">
          <span style={{ background: p.color || 'var(--accent)' }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const spider = useSpiderTheme();
  const statusColors = spider ? SV_STATUS_COLORS : STATUS_COLORS;
  const chartColors = spider ? SV_CHART_COLORS : CHART_COLORS;
  const tickFill = spider ? '#8eb0d0' : '#94a3b8';
  const axisFill = spider ? '#b8d4ec' : '#cbd5e1';
  const gridStroke = spider ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.06)';
  const barRadius = spider ? 0 : 4;
  const [range, setRange] = useState<AnalyticsRange>('week');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setError(null);
    void api
      .analytics(range)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const hourData = useMemo(() => {
    if (!summary) return [];
    return Array.from({ length: 24 }, (_, i) => {
      const key = String(i).padStart(2, '0');
      return {
        hour: formatHourTick(i),
        logs: summary.activityByHour?.[key] || 0,
      };
    });
  }, [summary]);

  const statusData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Done', value: summary.done, color: statusColors.done },
      { name: 'In progress', value: summary.wip, color: statusColors.wip },
      { name: 'Backlog', value: summary.none, color: statusColors.none },
    ].filter((d) => d.value > 0);
  }, [summary, statusColors]);

  const projectData = useMemo(
    () =>
      summary
        ? Object.entries(summary.byProject)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, value]) => ({ name, value }))
        : [],
    [summary],
  );

  const categoryData = useMemo(
    () =>
      summary
        ? Object.entries(summary.byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, value]) => ({ name, value }))
        : [],
    [summary],
  );

  const trendData = useMemo(
    () =>
      summary
        ? summary.recentDays.map((d) => ({
            date: formatAnalyticsDay(d.date, false),
            Logged: d.total,
            Done: d.done,
            WIP: d.wip,
          }))
        : [],
    [summary],
  );

  const periodLabel = useMemo(
    () =>
      summary
        ? formatAnalyticsPeriodLabel(summary.range, summary.rangeFrom, summary.rangeTo)
        : analyticsRangePrefix(range),
    [summary, range],
  );

  const periodSpan = useMemo(
    () =>
      summary ? formatAnalyticsDateSpan(summary.rangeFrom, summary.rangeTo) : '',
    [summary],
  );

  async function exportCsv() {
    setExporting(true);
    try {
      const csv = await api.analyticsCsv(range);
      const span =
        summary?.rangeFrom && summary?.rangeTo
          ? formatAnalyticsFilenameSpan(summary.rangeFrom, summary.rangeTo)
          : range;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daybook-report-${span}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast(`Report downloaded · ${periodLabel}`);
      window.setTimeout(() => setToast(null), 2800);
    } catch (err) {
      setToast((err as Error).message || 'Export failed');
      window.setTimeout(() => setToast(null), 2800);
    } finally {
      setExporting(false);
    }
  }

  if (error) {
    return (
      <div className="page">
        <div className="page-header animate-fade-in">
          <h1>Analytics</h1>
          <p className="page-sub" style={{ color: 'var(--status-high)' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="page an-loading">
        <SpideyLoader label="Loading your local history…" />
      </div>
    );
  }

  return (
    <div className="page an-page animate-fade-in">
      <header className="an-hero">
        <div className="an-hero-copy">
          <p className="an-kicker">Analytics</p>
          <h1>{analyticsRangePrefix(summary.range)}</h1>
          <p className="an-period">{periodSpan || 'No dates in range'}</p>
          <p className="an-sub">
            Charts for you — task report CSV for your manager (created, updated, completed / still running).
          </p>
        </div>
        <div className="an-hero-actions">
          <div className="an-range" role="tablist" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={range === r.id}
                className={`an-range-btn${range === r.id ? ' is-active' : ''}`}
                onClick={() => setRange(r.id)}
                title={
                  range === r.id && periodSpan
                    ? `${r.label} · ${periodSpan}`
                    : r.label
                }
              >
                <span className="an-range-btn-label">{r.label}</span>
                {range === r.id && periodSpan ? (
                  <span className="an-range-btn-dates">{periodSpan}</span>
                ) : null}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" disabled={exporting} onClick={() => void exportCsv()}>
            <Icon icon={I.download} width={15} />
            {exporting ? 'Exporting…' : 'Export task report'}
          </button>
        </div>
      </header>

      <section className="an-metrics" aria-label="Summary metrics">
        <MetricCard label="Completion" value={`${summary.completionRate}%`} hint={`${summary.done} done`} />
        <MetricCard label="Tasks logged" value={summary.totalTasks} hint={periodSpan || periodLabel} />
        <MetricCard label="Active days" value={summary.daysWithData} hint="Days with work" />
        <MetricCard label="In progress" value={summary.wip} hint={`${summary.none} backlog`} />
        <MetricCard label="Avg WIP age" value={`${summary.averageWipAgeDays}d`} hint="Carried work" />
        <MetricCard label="Active streak" value={summary.streakDays} hint="Consecutive days" />
      </section>

      <div className="an-grid-2">
        <section className="an-panel">
          <div className="an-panel-head">
            <h2>Daily trend</h2>
            <p>Logged vs done across the range</p>
          </div>
          {trendData.length === 0 ? (
            <p className="page-sub">No days in this range yet.</p>
          ) : (
            <div className="an-chart">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: tickFill, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="Logged" stroke={spider ? '#4aa8e8' : '#60a5fa'} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Done" stroke={spider ? '#7ecdb8' : '#22c55e'} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="WIP" stroke={spider ? '#d4a017' : '#f59e0b'} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="an-panel">
          <div className="an-panel-head">
            <h2>Status mix</h2>
            <p>Done / in progress / backlog</p>
          </div>
          {statusData.length === 0 ? (
            <p className="page-sub">No tasks in this range.</p>
          ) : (
            <div className="an-chart an-chart--pie">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={spider ? 0 : 3}
                  >
                    {statusData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="an-panel">
        <div className="an-panel-head">
          <h2>Day rhythm</h2>
          <p>When you usually log work (24-hour clock)</p>
        </div>
        {hourData.every((h) => h.logs === 0) ? (
          <p className="page-sub">Not enough logs yet for a rhythm chart.</p>
        ) : (
          <div className="an-chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: tickFill, fontSize: 10 }} interval={2} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="logs" name="Logs" fill={spider ? '#1a7fc4' : '#3b82f6'} radius={[barRadius, barRadius, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="an-grid-2">
        <section className="an-panel">
          <div className="an-panel-head">
            <h2>Projects</h2>
            <p>Where board energy goes</p>
          </div>
          {!projectData.length ? (
            <p className="page-sub">Log tasks under a project to see this.</p>
          ) : (
            <div className="an-chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={projectData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tick={{ fill: axisFill, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Tasks" radius={[0, barRadius, barRadius, 0]}>
                    {projectData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="an-panel">
          <div className="an-panel-head">
            <h2>Categories</h2>
            <p>What kind of work shows up most</p>
          </div>
          {!categoryData.length ? (
            <p className="page-sub">Add categories to your tasks to see this.</p>
          ) : (
            <div className="an-chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fill: axisFill, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Tasks" fill={spider ? '#7ecdb8' : '#14b8a6'} radius={[0, barRadius, barRadius, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="an-panel">
        <div className="an-panel-head">
          <h2>Day breakdown</h2>
          <p>Shareable table for the selected range</p>
        </div>
        <div className="table-panel table-scroll">
          <Scrollbar orientation="horizontal" autoHide className="table-scroll-area">
            <div className="table-scroll-inner">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ textAlign: 'center' }}>Logged</th>
                    <th style={{ textAlign: 'center' }}>Done</th>
                    <th style={{ textAlign: 'center' }}>WIP</th>
                    <th style={{ textAlign: 'center' }}>Backlog</th>
                  </tr>
                </thead>
                <tbody>
                  {[...summary.recentDays].reverse().map((d) => (
                    <tr key={d.date}>
                      <td style={{ fontWeight: 600 }}>{formatAnalyticsDay(d.date)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 650 }}>{d.total}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="table-stat table-stat--done">{d.done}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="table-stat table-stat--wip">{d.wip}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="table-stat table-stat--none">{d.none}</span>
                      </td>
                    </tr>
                  ))}
                  {summary.recentDays.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                        No history in this range. Work on the Board will show up here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Scrollbar>
        </div>
      </section>

      {toast ? (
        <div className="toast" role="status">
          <Icon icon={I.toastCheck} width={16} style={{ color: 'var(--status-done)' }} />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
