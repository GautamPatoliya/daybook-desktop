'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { api } from '../../lib/api';
import { I } from '../../lib/icons';
import type { AnalyticsSummary } from '../../../shared/types';

const GRADIENTS = [
  'linear-gradient(90deg, #3b82f6, #60a5fa)', // blue
  'linear-gradient(90deg, #14b8a6, #2dd4bf)', // teal
  'linear-gradient(90deg, #8b5cf6, #a78bfa)', // purple
  'linear-gradient(90deg, #f59e0b, #fbbf24)', // amber
  'linear-gradient(90deg, #ec4899, #f472b6)', // pink
  'linear-gradient(90deg, #10b981, #34d399)', // green
  'linear-gradient(90deg, #ef4444, #f87171)', // red
  'linear-gradient(90deg, #6366f1, #818cf8)', // indigo
];

function formatIndianDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mIndex = Number(m) - 1;
  return `${Number(d)} ${months[mIndex] || m} ${y}`;
}

function PremiumBarList({
  data,
  empty,
}: {
  data: [string, number][];
  empty: string;
}) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  if (!data.length) {
    return <p className="page-sub" style={{ margin: 0 }}>{empty}</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {data.map(([label, value], i) => {
        const pct = (value / max) * 100;
        const grad = GRADIENTS[i % GRADIENTS.length];
        return (
          <div key={label} className="premium-bar-row">
            <div className="premium-bar-info">
              <span className="premium-bar-label" title={label}>{label}</span>
              <span className="premium-bar-val">{value}</span>
            </div>
            <div className="premium-bar-track">
              <div
                className="premium-bar-fill"
                style={{
                  width: `${pct}%`,
                  background: grad,
                  boxShadow: `0 0 10px ${grad.match(/#[0-9a-fA-F]{6}/)?.[0] || 'var(--accent)'}40`
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void api
      .analytics()
      .then(setSummary)
      .catch((err) => setError((err as Error).message));
  }, []);

  const hourBars = useMemo(() => {
    if (!summary) return [];
    const fullHours: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      const hStr = String(i).padStart(2, '0');
      fullHours[hStr] = summary.activityByHour?.[hStr] || 0;
    }
    const max = Math.max(1, ...Object.values(fullHours));
    return Object.entries(fullHours).map(([hour, count]) => ({
      hour,
      count,
      h: count === 0 ? 0 : Math.max(8, Math.round((count / max) * 100)),
    }));
  }, [summary]);

  if (error) {
    return (
      <div className="page">
        <div className="page-header animate-fade-in">
          <h1>Analytics</h1>
          <p className="page-sub" style={{ color: 'var(--status-high)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)' }}>
        <Icon icon={I.dot} width={40} style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
        <p className="page-sub" style={{ marginTop: '1rem' }}>Loading your local history…</p>
      </div>
    );
  }

  const projects = Object.entries(summary.byProject).sort((a, b) => b[1] - a[1]);
  const categories = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
  const recent = [...summary.recentDays].reverse().slice(0, 10);

  return (
    <div className="page animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header section */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          maxWidth: 'none',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '0.2rem'
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 850, letterSpacing: '-0.02em', margin: '0 0 0.4rem 0' }}>
            Workplace Analytics
          </h1>
          <p className="page-sub" style={{ margin: 0 }}>
            A premium, localized breakdown of your work trends, hours, and activity. Stored securely on your PC.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: '99px',
            padding: '0.55rem 1.2rem',
            fontWeight: 650,
            fontSize: '0.85rem'
          }}
          onClick={async () => {
            const csv = await api.analyticsCsv();
            await navigator.clipboard.writeText(csv);
            setToast('CSV exported to clipboard');
            window.setTimeout(() => setToast(null), 2200);
          }}
        >
          <Icon icon={I.copy} width={15} /> Export CSV
        </button>
      </div>

      {/* Metrics Row */}
      <div className="analytics-metric-grid">
        <div className="premium-metric-card">
          <div className="premium-metric-val" style={{ background: 'linear-gradient(135deg, #34d399, #059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {summary.completionRate}%
          </div>
          <div className="premium-metric-lbl">Finished</div>
        </div>
        <div className="premium-metric-card">
          <div className="premium-metric-val">{summary.totalTasks}</div>
          <div className="premium-metric-lbl">Total Tasks</div>
        </div>
        <div className="premium-metric-card">
          <div className="premium-metric-val" style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {summary.streakDays}
          </div>
          <div className="premium-metric-lbl">Day Streak</div>
        </div>
        <div className="premium-metric-card">
          <div className="premium-metric-val">{summary.daysWithData}</div>
          <div className="premium-metric-lbl">Active Days</div>
        </div>
        <div className="premium-metric-card">
          <div className="premium-metric-val" style={{ background: 'linear-gradient(135deg, #60a5fa, #2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {summary.wip}
          </div>
          <div className="premium-metric-lbl">In Progress</div>
        </div>
        <div className="premium-metric-card">
          <div className="premium-metric-val">{summary.averageWipAgeDays}</div>
          <div className="premium-metric-lbl">Avg Age (Days)</div>
        </div>
      </div>

      {/* Grid: Projects / Categories list */}
      <div className="grid-2">
        <section className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
            <Icon icon={I.folder} width={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Where your time goes</h2>
          </div>
          <PremiumBarList data={projects} empty="Log tasks under a project to see this chart." />
        </section>
        <section className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
            <Icon icon={I.tag} width={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>What kind of work</h2>
          </div>
          <PremiumBarList data={categories} empty="Add categories to your tasks to see this chart." />
        </section>
      </div>

      {/* Hourly activity bar chart */}
      <section className="chart-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
          <Icon icon={I.clock} width={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Hourly Log Distribution</h2>
        </div>
        
        {hourBars.length === 0 ? (
          <p className="page-sub" style={{ margin: 0 }}>Not enough logs logged yet to display activity trends.</p>
        ) : (
          <div className="activity-hour-box" style={{ padding: '0.5rem 0' }}>
            <div className="hour-chart" aria-label="Activity by hour" style={{ height: '160px', gap: '6px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              {hourBars.map((h) => {
                const hourNum = Number(h.hour);
                const isTick = hourNum % 3 === 0;
                const formattedTick = hourNum === 0 ? '12 AM' : hourNum === 12 ? '12 PM' : hourNum > 12 ? `${hourNum - 12} PM` : `${hourNum} AM`;

                return (
                  <div key={h.hour} className="hour-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }} title={`${formattedTick} — ${h.count} tasks logged`}>
                    <div
                      className="hour-bar premium-hour-bar"
                      style={{
                        height: `${h.h}%`,
                        minHeight: h.count > 0 ? '6px' : '2px',
                        background: h.count > 0 ? 'linear-gradient(180deg, var(--accent), #3b82f6)' : 'rgba(255,255,255,0.03)',
                        borderRadius: '4px',
                        width: '100%',
                        transition: 'all 0.2s',
                        boxShadow: h.count > 0 ? '0 0 10px rgba(59, 130, 246, 0.4)' : 'none'
                      }}
                    />
                    <span className="hour-tick" style={{ fontSize: '0.68rem', fontWeight: 600, marginTop: '8px', color: isTick ? 'var(--text-muted)' : 'transparent', whiteSpace: 'nowrap' }}>
                      {formattedTick}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Recent days history */}
      <section className="chart-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
          <Icon icon={I.list} width={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Daily Logs (Last 10 Active Days)</h2>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.8rem 0.5rem', fontSize: '0.75rem' }}>Date</th>
                <th style={{ padding: '0.8rem 0.5rem', fontSize: '0.75rem', textAlign: 'center' }}>Total Logged</th>
                <th style={{ padding: '0.8rem 0.5rem', fontSize: '0.75rem', textAlign: 'center' }}>Completed</th>
                <th style={{ padding: '0.8rem 0.5rem', fontSize: '0.75rem', textAlign: 'center' }}>In Progress</th>
                <th style={{ padding: '0.8rem 0.5rem', fontSize: '0.75rem', textAlign: 'center' }}>Backlog</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{formatIndianDate(d.date)}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text)', textAlign: 'center', fontWeight: 650 }}>{d.total}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ color: 'var(--status-done)', background: 'rgba(34,197,94,0.08)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                      {d.done}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ color: 'var(--status-wip)', background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                      {d.wip}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ color: 'var(--text-dim)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 }}>
                      {d.none}
                    </span>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                    No history logged yet. Work logged on the Board will display here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {toast && (
        <div className="toast" role="status">
          <Icon icon={I.toastCheck} width={16} style={{ color: 'var(--status-done)' }} />
          {toast}
        </div>
      )}

      <style jsx global>{`
        .animate-fade-in {
          animation: page-fade-in 0.35s ease-out;
        }
        @keyframes page-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
