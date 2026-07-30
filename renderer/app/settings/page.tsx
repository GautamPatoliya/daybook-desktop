'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { I } from '../../lib/icons';
import { TimePicker } from '../../components/TimePicker';
import { Select } from '../../components/Select';
import { formatClock, formatHourLabel } from '../../lib/time';
import type { AppSettings } from '../../../shared/types';
import { activeProjectNames } from '../../../shared/types';

const DAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.getSettings().then(setSettings);
  }, []);

  if (!settings) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)' }}>
        <Icon icon={I.dot} width={30} style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
        <p className="page-sub" style={{ marginTop: '1rem' }}>Loading settings…</p>
      </div>
    );
  }

  const projects = activeProjectNames(settings.projects);

  async function save(partial?: Partial<AppSettings>) {
    setSaving(true);
    try {
      const next = await api.saveSettings(partial || settings!);
      setSettings(next);
      setToast('Settings saved');
      window.setTimeout(() => setToast(null), 2200);
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page" style={{ paddingBottom: '3rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 850, letterSpacing: '-0.02em', margin: '0 0 0.4rem 0' }}>
          Settings & Preferences
        </h1>
        <p className="page-sub" style={{ margin: 0 }}>
          Manage your author profile, working schedule, reminder increments, default project categorizations, and local databases.
        </p>
      </div>

      {/* Your Profile Card */}
      <section className="settings-section-card">
        <h2 className="settings-section-title">
          <Icon icon={I.user} width={18} style={{ color: 'var(--accent)' }} />
          Your Profile
        </h2>
        <p className="settings-section-desc">
          These details are used to auto-sign your daily work logs and format email draft summaries.
        </p>
        <div className="grid-2">
          <div className="field">
            <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your Name</label>
            <input
              value={settings.authorName}
              onChange={(e) => setSettings({ ...settings, authorName: e.target.value })}
              placeholder="e.g. Alex Rivera"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem' }}
            />
          </div>
          <div className="field">
            <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Timezone</label>
            <input
              value={settings.timezone}
              disabled
              placeholder="e.g. Asia/Kolkata"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', color: 'var(--text-muted)', cursor: 'not-allowed' }}
            />
            <span className="field-hint">Defines your local day rolls. Usually matches your workspace location.</span>
          </div>
        </div>
        <div className="field" style={{ marginTop: '1rem' }}>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Default Email Recipients</label>
          <textarea
            rows={2}
            value={settings.emailTo}
            onChange={(e) => setSettings({ ...settings, emailTo: e.target.value })}
            placeholder="manager@company.com, team@company.com"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', resize: 'vertical' }}
          />
          <span className="field-hint">Comma separated email addresses. Loaded automatically in the Gmail composer.</span>
        </div>
        <div className="field" style={{ marginTop: '1rem' }}>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Email Sign-off</label>
          <textarea
            rows={3}
            value={settings.signOff.join('\n')}
            onChange={(e) =>
              setSettings({
                ...settings,
                signOff: e.target.value
                  .split(/\r?\n/)
                  .map((l) => l.trimEnd())
                  .filter((l) => l.length),
              })
            }
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', resize: 'vertical' }}
          />
          <span className="field-hint">Appears at the very bottom of daily reports (one line per row).</span>
        </div>
      </section>

      {/* Working Days & Reminders Card */}
      <section className="settings-section-card">
        <h2 className="settings-section-title">
          <Icon icon={I.clock} width={18} style={{ color: 'var(--accent)' }} />
          Working Days & Reminders
        </h2>
        <p className="settings-section-desc">
          Control when reminders trigger check-ins. Reminders will never nudge you outside of these periods.
        </p>
        <div className="field" style={{ marginBottom: '1.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Active Working Days</span>
          <div className="working-days-grid">
            {DAYS.map((d) => {
              const on = settings.workingDays.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  className={`day-badge-btn ${on ? 'is-active' : ''}`}
                  onClick={() => {
                    const next = on
                      ? settings.workingDays.filter((x) => x !== d.v)
                      : [...settings.workingDays, d.v].sort();
                    setSettings({ ...settings, workingDays: next });
                  }}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Reminders Start</label>
            <TimePicker
              aria-label="Reminders start time"
              hour={settings.popupHours.hourlyStart}
              onChange={({ hour }) =>
                setSettings({
                  ...settings,
                  popupHours: { ...settings.popupHours, hourlyStart: hour },
                })
              }
            />
            <span className="field-hint">Nudges begin after {formatHourLabel(settings.popupHours.hourlyStart)}</span>
          </div>
          <div className="field">
            <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Reminders End</label>
            <TimePicker
              aria-label="Reminders end time"
              hour={settings.popupHours.hourlyEnd}
              onChange={({ hour }) =>
                setSettings({
                  ...settings,
                  popupHours: { ...settings.popupHours, hourlyEnd: hour },
                })
              }
            />
            <span className="field-hint">Nudges terminate after {formatHourLabel(settings.popupHours.hourlyEnd)}</span>
          </div>
          <div className="field">
            <Select
              label="Check-in Frequency"
              icon={I.clock}
              value={String(settings.reminderIntervalMinutes)}
              onChange={(v) =>
                setSettings({ ...settings, reminderIntervalMinutes: Number(v) })
              }
              options={[
                { value: '30', label: 'Every 30 minutes' },
                { value: '60', label: 'Every hour' },
                { value: '90', label: 'Every 90 minutes' },
                { value: '120', label: 'Every 2 hours' },
              ]}
            />
          </div>
          <div className="field">
            <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>End-of-Day EOD Reminder</label>
            <TimePicker
              aria-label="End of day reminder"
              hour={settings.eodHour}
              minute={settings.eodMinute}
              showMinutes
              onChange={({ hour, minute }) =>
                setSettings({ ...settings, eodHour: hour, eodMinute: minute })
              }
            />
            <span className="field-hint">
              Daily sign-off reminder at {formatClock(settings.eodHour, settings.eodMinute)}
            </span>
          </div>
        </div>
      </section>

      {/* Projects & Categories Card */}
      <section className="settings-section-card">
        <h2 className="settings-section-title">
          <Icon icon={I.projects} width={18} style={{ color: 'var(--accent)' }} />
          Projects & Categories
        </h2>
        <p className="settings-section-desc">
          Set baseline configurations for task management and default email outputs.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Link href="/projects/" className="btn btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.82rem' }}>
            <Icon icon={I.projects} width={15} /> Edit Projects List
          </Link>
        </div>
        <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
          <div className="field">
            <Select
              label="Default Task Project"
              icon={I.folder}
              value={settings.defaultProject}
              onChange={(v) => setSettings({ ...settings, defaultProject: v })}
              options={projects.map((p) => ({ value: p, label: p }))}
            />
          </div>
          <div className="field">
            <Select
              label="Default Email Context"
              icon={I.mail}
              value={settings.emailDefaultProject}
              onChange={(v) => setSettings({ ...settings, emailDefaultProject: v })}
              options={[
                { value: 'master', label: 'All Projects (Consolidated)' },
                ...projects.map((p) => ({ value: p, label: `${p} only` })),
              ]}
            />
          </div>
        </div>
        <div className="field">
          <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Task Categories</label>
          <textarea
            rows={5}
            value={settings.categories.join('\n')}
            onChange={(e) =>
              setSettings({
                ...settings,
                categories: e.target.value
                  .split(/\r?\n/)
                  .map((l) => l.trim())
                  .filter(Boolean),
              })
            }
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.55rem', resize: 'vertical' }}
          />
          <span className="field-hint">One category per line. Defines selection list for task tags.</span>
        </div>
      </section>

      {/* App Behavior Card */}
      <section className="settings-section-card">
        <h2 className="settings-section-title">
          <Icon icon={I.settings} width={18} style={{ color: 'var(--accent)' }} />
          App Behavior
        </h2>
        <p className="settings-section-desc">
          Customize startup configurations and automated text polishing features.
        </p>
        
        <div className="premium-toggle-row">
          <input
            type="checkbox"
            id="autostart"
            checked={settings.autostart}
            style={{ marginTop: '4px', cursor: 'pointer' }}
            onChange={(e) => setSettings({ ...settings, autostart: e.target.checked })}
          />
          <label htmlFor="autostart" style={{ cursor: 'pointer' }}>
            <strong style={{ display: 'block', fontSize: '0.9rem', color: '#fff', marginBottom: '2px' }}>Start Daybook on OS Login</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Keeps tray timers and reminders active immediately upon starting your computer.</span>
          </label>
        </div>

        <div className="premium-toggle-row" style={{ margin: 0 }}>
          <input
            type="checkbox"
            id="ai"
            checked={settings.aiEnhanceEnabled}
            style={{ marginTop: '4px', cursor: 'pointer' }}
            onChange={(e) => setSettings({ ...settings, aiEnhanceEnabled: e.target.checked })}
          />
          <label htmlFor="ai" style={{ cursor: 'pointer' }}>
            <strong style={{ display: 'block', fontSize: '0.9rem', color: '#fff', marginBottom: '2px' }}>Polish Drafts with Local AI</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Runs text entries through downloaded Local GGUF models. Falls back to a basic punctuation polisher if disabled.</span>
          </label>
        </div>
      </section>

      {/* Your Data Card (Danger Zone) */}
      <section className="settings-section-card risk-alert-card">
        <h2 className="settings-section-title risk-alert-title">
          <Icon icon={I.trash} width={18} style={{ color: '#f87171' }} />
          Local Database (Danger Zone)
        </h2>
        <p className="settings-section-desc" style={{ color: 'var(--text-muted)' }}>
          Daybook runs entirely locally. Open data files for manual backups or delete historical task logs from disk.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => void api.openDataFolder()}>
            <Icon icon={I.folder} width={14} /> Open Data Folder
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (!confirm('Delete all local task history on this computer? Settings are kept.')) return;
              await api.wipeData();
              setToast('Task history cleared');
            }}
          >
            <Icon icon={I.trash} width={14} /> Clear Task History
          </button>
        </div>
      </section>

      {/* Save Button */}
      <button type="button" className="btn btn-primary" style={{ padding: '0.65rem 1.5rem', background: 'linear-gradient(135deg, var(--accent), #3b82f6)' }} disabled={saving} onClick={() => void save()}>
        <Icon icon={I.save} width={16} /> {saving ? 'Saving Preferences…' : 'Save Settings'}
      </button>

      {toast && (
        <div className="toast" role="status">
          <Icon icon={I.toastCheck} width={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
