'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, I } from '../../lib/icons';
import SpideyLoader from '../../components/SpideyLoader';
import { api } from '../../lib/api';
import { TimePicker } from '../../components/TimePicker';
import { formatHourLabel } from '../../lib/time';
import type { AppSettings } from '../../../shared/types';

const DAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.getSettings().then((s) => {
      setSettings(s);
      if (s.onboardingComplete) router.replace('/');
    });
  }, [router]);

  if (!settings) {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-loading">
          <SpideyLoader label="Initializing your workspace…" />
        </div>
      </div>
    );
  }

  async function finish() {
    setBusy(true);
    await api.saveSettings({ ...settings!, onboardingComplete: true, autostart: true });
    setBusy(false);
    router.replace('/');
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        <div className="onboarding-brand">
          <div className="onboarding-brand-mark">
            <Icon icon={I.logo} width={24} style={{ color: '#fff' }} />
          </div>
          <h1>Welcome to Daybook</h1>
          <p className="page-sub">Let&apos;s configure your local daily workspace companion.</p>
        </div>

        <div className="onboarding-steps" aria-hidden>
          <span className={step >= 0 ? 'on' : undefined} />
          <span className={step >= 1 ? 'on' : undefined} />
          <span className={step >= 2 ? 'on' : undefined} />
        </div>

        <div className="onboarding-body animate-fade-in">
          {step === 0 && (
            <>
              <h2>1. Set Up Your Profile</h2>
              <p className="page-sub">
                We&apos;ll use your name to automatically sign your daily work summaries and prepare EOD drafts.
              </p>

              <div className="field">
                <label>Your Name</label>
                <input
                  value={settings.authorName}
                  onChange={(e) => setSettings({ ...settings, authorName: e.target.value })}
                  placeholder="e.g. Alex Rivera"
                  autoFocus
                />
              </div>

              <div className="field">
                <label>EOD Email Recipient(s)</label>
                <textarea
                  rows={2}
                  value={settings.emailTo}
                  onChange={(e) => setSettings({ ...settings, emailTo: e.target.value })}
                  placeholder="manager@company.com, team@company.com"
                />
                <span className="field-hint">Separate multiple emails with commas.</span>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2>2. Define Your Work Hours</h2>
              <p className="page-sub">
                Choose your regular workdays. Reminders only run during these shifts.
              </p>

              <div className="field">
                <span className="field-label">Active Workdays</span>
                <div className="onboarding-days">
                  {DAYS.map((d) => {
                    const on = settings.workingDays.includes(d.v);
                    return (
                      <button
                        key={d.v}
                        type="button"
                        className={`onboarding-day${on ? ' on' : ''}`}
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

              <div className="grid-2 onboarding-hours">
                <div className="field">
                  <label>Reminders Start</label>
                  <TimePicker
                    hour={settings.popupHours.hourlyStart}
                    onChange={({ hour }) =>
                      setSettings({
                        ...settings,
                        popupHours: { ...settings.popupHours, hourlyStart: hour },
                      })
                    }
                  />
                  <span className="field-hint">Starts at {formatHourLabel(settings.popupHours.hourlyStart)}</span>
                </div>
                <div className="field">
                  <label>Reminders End</label>
                  <TimePicker
                    hour={settings.popupHours.hourlyEnd}
                    onChange={({ hour }) =>
                      setSettings({
                        ...settings,
                        popupHours: { ...settings.popupHours, hourlyEnd: hour },
                      })
                    }
                  />
                  <span className="field-hint">Ends at {formatHourLabel(settings.popupHours.hourlyEnd)}</span>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>3. Everything is Ready!</h2>
              <p className="page-sub">
                All task logs, schedules, and settings are stored <strong>100% locally</strong> on this PC.
              </p>

              <div className="status-banner ok onboarding-banner">
                <Icon icon={I.success} width={20} style={{ color: 'var(--status-done)', flexShrink: 0 }} />
                <div>
                  <h3>Tray Integration &amp; Autostart</h3>
                  <p>
                    Autostart is enabled so hourly and end-of-day reminders work after you sign in to Windows.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="onboarding-actions">
          {step === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!settings.authorName.trim()}
              onClick={() => setStep(1)}
            >
              Configure Schedule
            </button>
          )}
          {step === 1 && (
            <>
              <button type="button" className="btn" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
                Review Setup
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button type="button" className="btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void finish()}
              >
                {busy ? 'Saving...' : 'Open My Board'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
