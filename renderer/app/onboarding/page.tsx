'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { api } from '../../lib/api';
import { TimePicker } from '../../components/TimePicker';
import { I } from '../../lib/icons';
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
      <div className="onboarding-shell" style={{ background: '#090b10', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Icon icon={I.dot} width={36} style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
        <p className="page-sub" style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Initializing your workspace...</p>
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
    <div className="onboarding-shell" style={{ background: 'radial-gradient(circle at top, #161e31 0%, #090b10 80%)', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem 1rem' }}>
      <div className="onboarding-card" style={{ width: 'min(480px, 100%)', background: '#0d1017', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '2.2rem 2rem', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', transition: 'all 0.3s ease' }}>
        
        {/* Header branding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--accent), #3b82f6)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
            marginBottom: '1rem',
            animation: 'pulse 2.5s infinite'
          }}>
            <Icon icon={I.logo} width={24} style={{ color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
            Welcome to Daybook
          </h1>
          <p className="page-sub" style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Let's configure your local daily workspace companion.
          </p>
        </div>

        {/* Steps Tracker */}
        <div className="onboarding-steps" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          <span style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 0 ? 'var(--accent)' : 'rgba(255,255,255,0.06)', transition: 'background 0.3s' }} />
          <span style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 1 ? 'var(--accent)' : 'rgba(255,255,255,0.06)', transition: 'background 0.3s' }} />
          <span style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= 2 ? 'var(--accent)' : 'rgba(255,255,255,0.06)', transition: 'background 0.3s' }} />
        </div>

        {/* STEP 1: Profile Details */}
        {step === 0 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '0 0 0.2rem 0' }}>1. Set Up Your Profile</h2>
            <p className="page-sub" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
              We'll use your name to automatically sign your daily work summaries and prepare EOD drafts.
            </p>
            
            <div className="field" style={{ marginTop: '0.5rem' }}>
              <label style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Your Name</label>
              <input
                value={settings.authorName}
                onChange={(e) => setSettings({ ...settings, authorName: e.target.value })}
                placeholder="e.g. Alex Rivera"
                autoFocus
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.8rem', fontSize: '0.9rem', width: '100%', color: '#fff' }}
              />
            </div>
            
            <div className="field">
              <label style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>EOD Email Recipient(s)</label>
              <textarea
                rows={2}
                value={settings.emailTo}
                onChange={(e) => setSettings({ ...settings, emailTo: e.target.value })}
                placeholder="manager@company.com, team@company.com"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.8rem', fontSize: '0.9rem', width: '100%', resize: 'none', color: '#fff' }}
              />
              <span className="field-hint" style={{ marginTop: '0.2rem' }}>You can specify multiple emails separating them with commas.</span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={!settings.authorName.trim()}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 650, background: 'linear-gradient(135deg, var(--accent), #3b82f6)', cursor: 'pointer', marginTop: '0.5rem' }}
              onClick={() => setStep(1)}
            >
              Configure Schedule
            </button>
          </div>
        )}

        {/* STEP 2: Shift Schedule */}
        {step === 1 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '0 0 0.2rem 0' }}>2. Define Your Work Hours</h2>
            <p className="page-sub" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
              Choose your regular workdays. Reminders will prompt you to log details only during these shifts.
            </p>
            
            <div className="field" style={{ marginTop: '0.5rem' }}>
              <span style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Active Workdays</span>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'space-between' }}>
                {DAYS.map((d) => {
                  const on = settings.workingDays.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => {
                        const next = on
                          ? settings.workingDays.filter((x) => x !== d.v)
                          : [...settings.workingDays, d.v].sort();
                        setSettings({ ...settings, workingDays: next });
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        fontSize: '0.78rem',
                        fontWeight: 650,
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: on ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                        background: on ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-input)',
                        color: on ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid-2" style={{ gap: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div className="field">
                <label style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Reminders Start</label>
                <TimePicker
                  hour={settings.popupHours.hourlyStart}
                  onChange={({ hour }) =>
                    setSettings({
                      ...settings,
                      popupHours: { ...settings.popupHours, hourlyStart: hour },
                    })
                  }
                />
                <span className="field-hint" style={{ marginTop: '0.2rem' }}>Starts at {formatHourLabel(settings.popupHours.hourlyStart)}</span>
              </div>
              <div className="field">
                <label style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Reminders End</label>
                <TimePicker
                  hour={settings.popupHours.hourlyEnd}
                  onChange={({ hour }) =>
                    setSettings({
                      ...settings,
                      popupHours: { ...settings.popupHours, hourlyEnd: hour },
                    })
                  }
                />
                <span className="field-hint" style={{ marginTop: '0.2rem' }}>Ends at {formatHourLabel(settings.popupHours.hourlyEnd)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn"
                style={{ padding: '0.75rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 650 }}
                onClick={() => setStep(0)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 650, background: 'linear-gradient(135deg, var(--accent), #3b82f6)', cursor: 'pointer' }}
                onClick={() => setStep(2)}
              >
                Review Setup
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Complete */}
        {step === 2 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '0 0 0.2rem 0' }}>3. Everything is Ready!</h2>
            <p className="page-sub" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
              All task logs, schedules, and settings are stored <strong>100% locally</strong> on this PC. Your privacy is secured.
            </p>
            
            <div className="status-banner ok" style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: 'rgba(16,185,129,0.05)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)', marginTop: '0.5rem' }}>
              <Icon icon={I.success} width={20} style={{ color: 'var(--status-done)', flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '0.88rem', fontWeight: 750, color: '#34d399' }}>Tray Integration & Autostart</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Autostart is enabled automatically so that workspace nudges and daily tray timers function immediately upon system boot.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn"
                style={{ padding: '0.75rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 650 }}
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 650, background: 'linear-gradient(135deg, var(--accent), #3b82f6)', cursor: 'pointer', boxShadow: '0 0 15px rgba(59,130,246,0.3)' }}
                disabled={busy}
                onClick={() => void finish()}
              >
                {busy ? 'Saving...' : 'Open My Board'}
              </button>
            </div>
          </div>
        )}

      </div>

      <style jsx global>{`
        .animate-fade-in {
          animation: onboarding-fade-in 0.35s ease-out;
        }
        @keyframes onboarding-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
