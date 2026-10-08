'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { api } from '../../lib/api';
import { Icon, I } from '../../lib/icons';
import SpideyLoader from '../../components/SpideyLoader';
import { TimePicker } from '../../components/TimePicker';
import { Select } from '../../components/Select';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { CategoryManager } from '../../components/CategoryManager';
import { EmailChipInput } from '../../components/EmailChipInput';
import { Scrollbar } from '../../components/Scrollbar';
import { useDialog } from '../../components/DialogProvider';
import { formatClock, formatHourLabel } from '../../lib/time';
import { useFormChanges } from '../../lib/useFormChanges';
import {
  mergeSuggestionPool,
  upsertEmailHistory,
} from '../../lib/emailRecipients';
import type { AppSettings } from '../../../shared/types';
import { activeProjectNames } from '../../../shared/types';
import {
  buildEmailFormatPreview,
  renderEmailMarkdownPreview,
} from '../../../shared/email';
import {
  ensureFeatureHighlightStarts,
  FEATURE_HIGHLIGHTS,
  isFeatureHighlightActive,
  type FeatureHighlightId,
} from '../../../shared/featureHighlights';
import { applyTheme } from '../../lib/theme';
import SpiderHeroPixel from '../../components/spider/SpiderHeroPixel';
import Cobweb from '../../components/spider/Cobweb';

const DAYS = [
  { v: 1, l: 'Monday' },
  { v: 2, l: 'Tuesday' },
  { v: 3, l: 'Wednesday' },
  { v: 4, l: 'Thursday' },
  { v: 5, l: 'Friday' },
  { v: 6, l: 'Saturday' },
  { v: 0, l: 'Sunday' },
];

type TabId = 'profile' | 'email' | 'schedule' | 'projects' | 'behavior' | 'appearance' | 'data';

const TABS: Array<{ id: TabId; label: string; icon: string; hint: string }> = [
  { id: 'profile', label: 'Profile', icon: I.user, hint: 'Name & timezone' },
  { id: 'email', label: 'Email', icon: I.mail, hint: 'Format & recipients' },
  { id: 'schedule', label: 'Schedule', icon: I.clock, hint: 'Days & reminders' },
  { id: 'projects', label: 'Projects', icon: I.projects, hint: 'Defaults & categories' },
  { id: 'behavior', label: 'Behavior', icon: I.settings, hint: 'Startup & polish' },
  { id: 'appearance', label: 'Appearance', icon: I.sparkles, hint: 'Themes & styling' },
  { id: 'data', label: 'Data', icon: I.folder, hint: 'Backup & wipe' },
];

export default function SettingsPage() {
  const [initial, setInitial] = useState<AppSettings | null>(null);
  const [engineInstalled, setEngineInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    void api.getSettings().then(setInitial);
    void api
      .engineStatus()
      .then((s) => setEngineInstalled(s.installed))
      .catch(() => setEngineInstalled(false));
  }, []);

  if (!initial) {
    return (
      <div className="page settings-loading">
        <SpideyLoader label="Loading settings…" />
      </div>
    );
  }

  return <SettingsForm initial={initial} engineInstalled={engineInstalled} />;
}

function SettingsForm({
  initial,
  engineInstalled,
}: {
  initial: AppSettings;
  engineInstalled: boolean | null;
}) {
  const { confirm } = useDialog();
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabId>('profile');
  const [spiderVerse, setSpiderVerse] = useState(false);
  const [highlightStarts, setHighlightStarts] = useState<Record<string, string>>(
    () => initial.featureHighlightStarts || {},
  );

  const methods = useForm<AppSettings>({
    defaultValues: initial,
    mode: 'onChange',
  });
  const { hasChanges } = useFormChanges({ methods });
  const settings = useWatch({ control: methods.control }) as AppSettings;

  useEffect(() => {
    const { starts, seeded } = ensureFeatureHighlightStarts(
      ['settings-email-tab', 'settings-projects-tab'],
      initial.featureHighlightStarts,
    );
    if (!seeded) return;
    setHighlightStarts(starts);
    // Persist clock quietly — must not depend on Save Settings
    void api.saveSettings({ featureHighlightStarts: starts }).catch(() => {
      /* non-blocking */
    });
  }, [initial.featureHighlightStarts]);

  function tabBadge(id: TabId): FeatureHighlightId | null {
    if (id === 'email') return 'settings-email-tab';
    if (id === 'projects') return 'settings-projects-tab';
    return null;
  }

  const patch = useCallback(
    (partial: Partial<AppSettings>) => {
      (Object.keys(partial) as Array<keyof AppSettings>).forEach((key) => {
        const value = partial[key];
        if (value !== undefined) {
          methods.setValue(key, value as AppSettings[typeof key], {
            shouldDirty: true,
            shouldTouch: true,
          });
        }
      });
    },
    [methods],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    const check = () =>
      setSpiderVerse(document.documentElement.getAttribute('data-theme') === 'spider-verse');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const emailPreview = useMemo(() => buildEmailFormatPreview(settings), [settings]);
  const recipientSuggestions = useMemo(
    () =>
      mergeSuggestionPool(
        settings.emailRecipientHistory,
        settings.emailTo || '',
        settings.emailCc || '',
      ),
    [settings.emailRecipientHistory, settings.emailTo, settings.emailCc],
  );
  const projects = activeProjectNames(settings.projects);
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];

  async function save() {
    setSaving(true);
    try {
      const next = await api.saveSettings(methods.getValues());
      methods.reset(next);
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
        <p className="page-sub">Profile, email format, schedule, and local data - one section at a time.</p>
      </div>

      <div className="settings-shell">
        <nav className="settings-nav" aria-label="Settings sections">
          <Scrollbar
            className="settings-nav-scroll"
            orientation="vertical"
            autoHide
            aria-label="Settings sections"
          >
            <div className="settings-nav-inner">
              {TABS.map((t) => {
                const active = tab === t.id;
                const badgeId = tabBadge(t.id);
                const showBadge =
                  badgeId != null && isFeatureHighlightActive(badgeId, highlightStarts);
                const badge = badgeId ? FEATURE_HIGHLIGHTS[badgeId] : null;
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
                    {showBadge && badge && badgeId ? (
                      <span
                        className={`settings-nav-badge settings-nav-badge--${
                          badgeId === 'settings-projects-tab' ? 'updated' : 'new'
                        }`}
                        title={`${badge.label} in this update · hides after ${badge.ttlDays} days`}
                      >
                        {badge.label}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Scrollbar>
        </nav>

        <div className="settings-main">
          <div
            className={`settings-panel${tab === 'email' ? ' settings-panel--email' : ' settings-panel--compact'}`}
          >
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

            <Scrollbar
              className="settings-panel-body"
              orientation="vertical"
              autoHide
              aria-label="Settings section"
            >
              <div
                className={`settings-panel-body-inner${tab === 'email' ? ' settings-panel-body-inner--email' : ''}`}
              >
                {tab === 'profile' && (
                  <div className="settings-compact-form">
                    <div className="field">
                      <label className="settings-label">Your Name</label>
                      <input
                        value={settings.authorName}
                        onChange={(e) => patch({ authorName: e.target.value })}
                        placeholder="e.g. Gautam"
                      />
                    </div>
                    <div className="field">
                      <label className="settings-label">Timezone</label>
                      <input value={settings.timezone} disabled className="is-disabled" />
                    </div>
                  </div>
                )}

                {tab === 'email' && (
                  <div className="email-format-studio">
                    <div className="email-format-editor">
                      <div className="field">
                        <label className="settings-label" htmlFor="settings-email-to">
                          To
                        </label>
                        <EmailChipInput
                          id="settings-email-to"
                          value={settings.emailTo}
                          suggestions={recipientSuggestions}
                          placeholder="manager@company.com"
                          onChange={(next) => patch({ emailTo: next })}
                          onCommitEmail={(email) =>
                            patch({
                              emailRecipientHistory: upsertEmailHistory(
                                settings.emailRecipientHistory,
                                email,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="field">
                        <label className="settings-label" htmlFor="settings-email-cc">
                          Cc
                        </label>
                        <EmailChipInput
                          id="settings-email-cc"
                          value={settings.emailCc}
                          suggestions={recipientSuggestions}
                          placeholder="stakeholder@company.com"
                          onChange={(next) => patch({ emailCc: next })}
                          onCommitEmail={(email) =>
                            patch({
                              emailRecipientHistory: upsertEmailHistory(
                                settings.emailRecipientHistory,
                                email,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="field">
                        <label className="settings-label" htmlFor="settings-email-signoff">
                          Sign-off
                        </label>
                        <textarea
                          id="settings-email-signoff"
                          rows={4}
                          value={settings.signOff.join('\n')}
                          onChange={(e) =>
                            patch({
                              signOff: e.target.value
                                .split(/\r?\n/)
                                .map((l) => l.trimEnd())
                                .filter((l) => l.length),
                            })
                          }
                          placeholder={'Thanks & Regards,'}
                        />
                      </div>
                      <ToggleSwitch
                        id="includeBacklogEmail"
                        checked={Boolean(settings.includeBacklogInEmail)}
                        onChange={(next) => patch({ includeBacklogInEmail: next })}
                        label="Include Backlog tasks"
                        description="Off by default - drafts list In progress and Done only."
                      />
                    </div>

                    <aside className="email-format-preview" aria-label="Live email preview">
                      <div className="email-format-preview-head">
                        <span className="email-format-preview-kicker">Live preview</span>
                      </div>
                      <div className="email-format-preview-meta">
                        <div className="email-format-preview-row">
                          <span>To</span>
                          <em>{settings.emailTo.trim() || '-'}</em>
                        </div>
                        <div className="email-format-preview-row">
                          <span>Cc</span>
                          <em>{settings.emailCc.trim() || '-'}</em>
                        </div>
                        <div className="email-format-preview-row">
                          <span>Subject</span>
                          <em>{emailPreview.subject || '-'}</em>
                        </div>
                      </div>
                      <Scrollbar
                        className="email-format-preview-body"
                        orientation="vertical"
                        autoHide
                        aria-label="Email preview body"
                      >
                        <div
                          className="mail-md-preview email-format-preview-html"
                          dangerouslySetInnerHTML={{
                            __html: renderEmailMarkdownPreview(emailPreview.body || ''),
                          }}
                        />
                      </Scrollbar>
                    </aside>
                  </div>
                )}

                {tab === 'schedule' && (
                  <>
                    <p className="settings-panel-lead">
                      Reminders only fire on working days, between the times you set below.
                    </p>
                    <div className="schedule-stack">
                      <div className="schedule-card">
                        <h3 className="schedule-card-title">Active working days</h3>
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
                                  patch({ workingDays: next });
                                }}
                              >
                                {d.l}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="schedule-card">
                        <h3 className="schedule-card-title">Reminder window</h3>
                        <div className="schedule-times">
                          <div className="schedule-field">
                            <label className="settings-label">Reminders start</label>
                            <TimePicker
                              aria-label="Reminders start time"
                              hour={settings.popupHours.hourlyStart}
                              onChange={({ hour }) =>
                                patch({
                                  popupHours: { ...settings.popupHours, hourlyStart: hour },
                                })
                              }
                            />
                            <span className="field-hint">
                              Nudges begin after {formatHourLabel(settings.popupHours.hourlyStart)}
                            </span>
                          </div>
                          <div className="schedule-field">
                            <label className="settings-label">Reminders end</label>
                            <TimePicker
                              aria-label="Reminders end time"
                              hour={settings.popupHours.hourlyEnd}
                              onChange={({ hour }) =>
                                patch({
                                  popupHours: { ...settings.popupHours, hourlyEnd: hour },
                                })
                              }
                            />
                            <span className="field-hint">
                              Nudges stop after {formatHourLabel(settings.popupHours.hourlyEnd)}
                            </span>
                          </div>
                          <div className="schedule-field">
                            <Select
                              label="Check-in frequency"
                              icon={I.clock}
                              value={String(settings.reminderIntervalMinutes)}
                              onChange={(v) => patch({ reminderIntervalMinutes: Number(v) })}
                              options={[
                                { value: '30', label: 'Every 30 minutes' },
                                { value: '60', label: 'Every hour' },
                                { value: '90', label: 'Every 90 minutes' },
                                { value: '120', label: 'Every 2 hours' },
                              ]}
                            />
                          </div>
                          <div className="schedule-field">
                            <label className="settings-label">End-of-day reminder</label>
                            <TimePicker
                              aria-label="End of day reminder"
                              hour={settings.eodHour}
                              minute={settings.eodMinute}
                              showMinutes
                              onChange={({ hour, minute }) =>
                                patch({ eodHour: hour, eodMinute: minute })
                              }
                            />
                            <span className="field-hint">
                              Daily sign-off at {formatClock(settings.eodHour, settings.eodMinute)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {tab === 'projects' && (
                  <>
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
                          onChange={(v) => patch({ defaultProject: v })}
                          options={projects.map((p) => ({ value: p, label: p }))}
                        />
                      </div>
                      <div className="field">
                        <Select
                          label="Default category"
                          icon={I.tag}
                          value={
                            settings.defaultCategory || settings.categories[0] || 'Other'
                          }
                          onChange={async (v) => {
                            try {
                              const res = await api.setDefaultCategory(v);
                              patch({
                                categories: res.categories,
                                defaultCategory: res.defaultCategory,
                              });
                            } catch (err) {
                              showToast((err as Error).message);
                            }
                          }}
                          options={settings.categories.map((c) => ({ value: c, label: c }))}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <CategoryManager
                        categories={settings.categories}
                        defaultCategory={
                          settings.defaultCategory || settings.categories[0] || 'Other'
                        }
                        showDefaultSelect={false}
                        onChange={(next) =>
                          patch({
                            categories: next.categories,
                            defaultCategory: next.defaultCategory,
                          })
                        }
                        showToast={showToast}
                      />
                    </div>
                  </>
                )}

                {tab === 'behavior' && (
                  <>
                    <p className="settings-panel-lead">
                      Startup and Local AI preferences. Email content lives under Email.
                    </p>
                    <div className="settings-switch-stack">
                      <ToggleSwitch
                        id="autostart"
                        checked={settings.autostart}
                        onChange={(next) => patch({ autostart: next })}
                        label="Start Daybook on OS login"
                        description="Keeps tray timers and reminders ready after you sign in."
                      />
                      <ToggleSwitch
                        id="ai"
                        checked={settings.aiEnhanceEnabled}
                        onChange={(next) => patch({ aiEnhanceEnabled: next })}
                        label="Prefer Local AI for polish"
                        description={
                          <>
                            Remembers your preference. <strong>Polish wording</strong> already uses
                            Local AI when the engine and a model are installed.
                          </>
                        }
                        warning={
                          settings.aiEnhanceEnabled && engineInstalled === false ? (
                            <>
                              Engine not installed - install it under{' '}
                              <Link href="/models/">Local AI</Link>.
                            </>
                          ) : settings.aiEnhanceEnabled &&
                            engineInstalled &&
                            !settings.selectedModelId ? (
                            <>
                              No model selected - choose one under{' '}
                              <Link href="/models/">Local AI</Link>.
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
                            ? 'Spidey Tracker HUD is online - red, blue, cream.'
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
                            patch({ theme: 'default' });
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
                            patch({ theme: 'spider-verse' });
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
                          <p className="field-hint">Pixel HUD - webs, cream CTAs, city night.</p>
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
                      Daybook stores everything on this PC. Back up the data folder or clear task
                      history if needed.
                    </p>
                    <div className="settings-danger-box">
                      <div className="settings-danger-head">
                        <Icon icon={I.warning} width={18} />
                        <strong>Local database</strong>
                      </div>
                      <p>
                        Open files for backup, or delete historical task logs. Settings are kept on
                        wipe.
                      </p>
                      <div className="settings-inline-actions">
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void api.openDataFolder()}
                        >
                          <Icon icon={I.folder} width={14} /> Open data folder
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Clear task history',
                              message:
                                'Delete all local task history on this computer? Settings are kept.',
                              confirmLabel: 'Clear history',
                              variant: 'danger',
                            });
                            if (!ok) return;
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
            </Scrollbar>

            {tab !== 'data' && (
              <footer className="settings-panel-footer">
                <div className="settings-save-status" aria-live="polite">
                  {hasChanges ? (
                    <span className="settings-unsaved-badge">
                      <span className="settings-unsaved-dot" aria-hidden />
                      Unsaved changes
                    </span>
                  ) : (
                    <span className="settings-saved-hint">All changes saved</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving || !hasChanges}
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
