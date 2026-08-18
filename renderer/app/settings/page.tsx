'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Icon, I } from '../../lib/icons';
import SpideyLoader from '../../components/SpideyLoader';
import { TimePicker } from '../../components/TimePicker';
import { Select } from '../../components/Select';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { formatClock, formatHourLabel } from '../../lib/time';
import type { AppSettings } from '../../../shared/types';
import { activeProjectNames } from '../../../shared/types';
import { applyTheme } from '../../lib/theme';
import SpiderHeroPixel from '../../components/spider/SpiderHeroPixel';
import Cobweb from '../../components/spider/Cobweb';

const DAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];

type TabId = 'profile' | 'schedule' | 'projects' | 'behavior' | 'appearance' | 'data';

const TABS: Array<{ id: TabId; label: string; icon: string; hint: string }> = [
  { id: 'profile', label: 'Profile', icon: I.user, hint: 'Name & email sign-off' },
  { id: 'schedule', label: 'Schedule', icon: I.clock, hint: 'Days & reminders' },
  { id: 'projects', label: 'Projects', icon: I.projects, hint: 'Defaults & categories' },
  { id: 'behavior', label: 'Behavior', icon: I.settings, hint: 'Startup & polish' },
  { id: 'appearance', label: 'Appearance', icon: I.sparkles, hint: 'Themes & styling' },
  { id: 'data', label: 'Data', icon: I.folder, hint: 'Backup & wipe' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [engineInstalled, setEngineInstalled] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>('profile');
  const [spiderVerse, setSpiderVerse] = useState(false);

  useEffect(() => {
    void api.getSettings().then(setSettings);
    void api
      .engineStatus()
      .then((s) => setEngineInstalled(s.installed))
      .catch(() => setEngineInstalled(false));
  }, []);

  useEffect(() => {
    const check = () =>
      setSpiderVerse(document.documentElement.getAttribute('data-theme') === 'spider-verse');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  if (!settings) {
    return (
      <div className="page settings-loading">
        <SpideyLoader label="Loading settings…" />
      </div>
    );
  }

  const projects = activeProjectNames(settings.projects);
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];

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
    <div className="page page-settings">
      <div className="page-header settings-page-header">
        <h1>Settings</h1>
        <p className="page-sub">Profile, schedule, projects, and local data — one section at a time.</p>
      </div>

      <div className="settings-shell">
        <nav className="settings-nav" aria-label="Settings sections">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`settings-nav-item${active ? ' is-active' : ''}${t.id === 'data' ? ' settings-nav-item--danger' : ''}`}
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
              >
                <span className="settings-nav-icon" aria-hidden>
                  <Icon icon={t.icon} width={16} />
                </span>
                <span className="settings-nav-text">
                  <span className="settings-nav-label">{t.label}</span>
                  <span className="settings-nav-hint">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="settings-main">
          <div className="settings-panel">
            <header className="settings-panel-header">
              <div className="settings-panel-icon" aria-hidden>
                {spiderVerse ? (
                  <SpiderHeroPixel variant="mask" size={24} />
                ) : (
                  <Icon icon={activeTab.icon} width={18} />
                )}
              </div>
              <div>
                <h2>{activeTab.label}</h2>
                <p>{activeTab.hint}</p>
              </div>
            </header>

            <div className="settings-panel-body">
              {tab === 'profile' && (
                <>
                  <p className="settings-panel-lead">
                    Used to sign daily work logs and pre-fill email draft summaries.
                  </p>
                  <div className="grid-2">
                    <div className="field">
                      <label className="settings-label">Your Name</label>
                      <input
                        value={settings.authorName}
                        onChange={(e) => setSettings({ ...settings, authorName: e.target.value })}
                        placeholder="e.g. Gautam"
                      />
                    </div>
                    <div className="field">
                      <label className="settings-label">Timezone</label>
                      <input value={settings.timezone} disabled className="is-disabled" />
                      <span className="field-hint">Defines local day rolls for this workspace.</span>
                    </div>
                  </div>
                  <div className="field">
                    <label className="settings-label">Default Email Recipients</label>
                    <textarea
                      rows={2}
                      value={settings.emailTo}
                      onChange={(e) => setSettings({ ...settings, emailTo: e.target.value })}
                      placeholder="manager@company.com, team@company.com"
                    />
                    <span className="field-hint">Comma-separated. Loaded in the Gmail composer.</span>
                  </div>
                  <div className="field">
                    <label className="settings-label">Email Sign-off</label>
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
                    />
                    <span className="field-hint">One line per row at the bottom of daily reports.</span>
                  </div>
                </>
              )}

              {tab === 'schedule' && (
                <>
                  <p className="settings-panel-lead">
                    Reminders only fire on working days, between the times you set below.
                  </p>
                  <div className="field">
                    <span className="settings-label">Active Working Days</span>
                    <div className="working-days-grid">
                      {DAYS.map((d) => {
                        const on = settings.workingDays.includes(d.v);
                        return (
                          <button
                            key={d.v}
                            type="button"
                            className={`day-badge-btn${on ? ' is-active' : ''}`}
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
                      <label className="settings-label">Reminders Start</label>
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
                      <span className="field-hint">
                        Nudges begin after {formatHourLabel(settings.popupHours.hourlyStart)}
                      </span>
                    </div>
                    <div className="field">
                      <label className="settings-label">Reminders End</label>
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
                      <span className="field-hint">
                        Nudges stop after {formatHourLabel(settings.popupHours.hourlyEnd)}
                      </span>
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
                      <label className="settings-label">End-of-Day Reminder</label>
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
                        Daily sign-off at {formatClock(settings.eodHour, settings.eodMinute)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {tab === 'projects' && (
                <>
                  <p className="settings-panel-lead">
                    Defaults for new tasks and how the daily email groups your work.
                  </p>
                  <div className="settings-inline-actions">
                    <Link href="/projects/" className="btn btn-primary settings-link-btn">
                      <Icon icon={I.projects} width={15} /> Manage projects
                    </Link>
                  </div>
                  <div className="grid-2">
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
                    <label className="settings-label">Task Categories</label>
                    <textarea
                      rows={6}
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
                    />
                    <span className="field-hint">One category per line for the task tag list.</span>
                  </div>
                </>
              )}

              {tab === 'behavior' && (
                <>
                  <p className="settings-panel-lead">Startup, email content, and Local AI preferences.</p>
                  <div className="settings-switch-stack">
                    <ToggleSwitch
                      id="autostart"
                      checked={settings.autostart}
                      onChange={(next) => setSettings({ ...settings, autostart: next })}
                      label="Start Daybook on OS login"
                      description="Keeps tray timers and reminders ready after you sign in."
                    />
                    <ToggleSwitch
                      id="includeBacklog"
                      checked={Boolean(settings.includeBacklogInEmail)}
                      onChange={(next) => setSettings({ ...settings, includeBacklogInEmail: next })}
                      label="Include Backlog in EOD email"
                      description="Off by default — drafts list In progress and Done only."
                    />
                    <ToggleSwitch
                      id="ai"
                      checked={settings.aiEnhanceEnabled}
                      onChange={(next) => setSettings({ ...settings, aiEnhanceEnabled: next })}
                      label="Prefer Local AI for polish"
                      description={
                        <>
                          Remembers your preference. <strong>Polish wording</strong> already uses Local AI when
                          the engine and a model are installed.
                        </>
                      }
                      warning={
                        settings.aiEnhanceEnabled && engineInstalled === false ? (
                          <>
                            Engine not installed — install it under{' '}
                            <Link href="/models/">Local AI</Link>.
                          </>
                        ) : settings.aiEnhanceEnabled && engineInstalled && !settings.selectedModelId ? (
                          <>
                            No model selected — choose one under <Link href="/models/">Local AI</Link>.
                          </>
                        ) : null
                      }
                    />
                  </div>
                </>
              )}

              {tab === 'appearance' && (
                <>
                  <div className="sv-suit-banner" aria-hidden={false}>
                    <SpiderHeroPixel variant="mask" size={28} />
                    <div>
                      <strong>SUIT SELECT</strong>
                      <p>
                        {settings.theme === 'spider-verse'
                          ? 'Spidey Tracker HUD is online — red, blue, cream.'
                          : 'Classic Daybook look. Pick Spider-Verse to suit up.'}
                      </p>
                    </div>
                  </div>
                  <p className="settings-panel-lead">Personalize the visual style of Daybook.</p>
                  <div className="field">
                    <label className="settings-label">Application Theme</label>
                    <div className="grid-2 sv-theme-grid">
                      <button
                        type="button"
                        className={`card theme-card ${settings.theme === 'default' ? 'theme-active' : ''}`}
                        onClick={() => {
                          setSettings({ ...settings, theme: 'default' });
                          applyTheme('default');
                        }}
                      >
                        <div className="theme-preview theme-preview-default">
                          <span className="theme-preview-bar" />
                          <span className="theme-preview-chip" />
                        </div>
                        <strong>Default</strong>
                        <p className="field-hint">Clean office board. No HUD chrome.</p>
                      </button>
                      <button
                        type="button"
                        className={`card theme-card ${settings.theme === 'spider-verse' ? 'theme-active' : ''}`}
                        onClick={() => {
                          setSettings({ ...settings, theme: 'spider-verse' });
                          applyTheme('spider-verse');
                        }}
                      >
                        <div className="theme-preview theme-preview-spidey">
                          <span className="theme-preview-web">
                            <Cobweb size={72} corner="top-right" opacity={0.7} />
                          </span>
                          <SpiderHeroPixel variant="spider" size={22} />
                          <span className="theme-preview-hud">DAYBOOK</span>
                        </div>
                        <strong>Spider-Verse</strong>
                        <p className="field-hint">Pixel HUD — webs, cream CTAs, city night.</p>
                        {settings.theme === 'spider-verse' && (
                          <span className="theme-live">ACTIVE</span>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {tab === 'data' && (
                <>
                  <p className="settings-panel-lead">
                    Daybook stores everything on this PC. Back up the data folder or clear task history if needed.
                  </p>
                  <div className="settings-danger-box">
                    <div className="settings-danger-head">
                      <Icon icon={I.warning} width={18} />
                      <strong>Local database</strong>
                    </div>
                    <p>Open files for backup, or delete historical task logs. Settings are kept on wipe.</p>
                    <div className="settings-inline-actions">
                      <button type="button" className="btn" onClick={() => void api.openDataFolder()}>
                        <Icon icon={I.folder} width={14} /> Open data folder
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={async () => {
                          if (!confirm('Delete all local task history on this computer? Settings are kept.'))
                            return;
                          await api.wipeData();
                          setToast('Task history cleared');
                        }}
                      >
                        <Icon icon={I.trash} width={14} /> Clear task history
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {tab !== 'data' && (
              <footer className="settings-panel-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  <Icon icon={I.save} width={16} />
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </footer>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast" role="status">
          <Icon icon={I.toastCheck} width={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
