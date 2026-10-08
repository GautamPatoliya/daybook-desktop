'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon, I } from '../../lib/icons';
import { api } from '../../lib/api';
import { parseIsoDate } from '../../lib/format';
import { Scrollbar } from '../../components/Scrollbar';
import {
  isUpdateUiPreview,
  runMockUpdateDownload,
  UPDATE_PREVIEW,
} from '../../lib/updatePreview';

type Phase = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error' | 'unavailable';

type ReleaseSection = {
  title: string;
  bullets: string[];
};

type ReleaseNote = {
  version: string;
  date: string;
  sections: ReleaseSection[];
};

function friendlyEventError(raw?: string): string {
  const msg = raw || 'Something went wrong while checking for updates.';
  if (/YOUR_GITHUB_USER/i.test(msg) || /404/.test(msg)) {
    return 'Updates aren’t set up for this build yet. Install a newer package when your team provides one.';
  }
  if (/packaged install|Updater did not run|forceDevUpdateConfig/i.test(msg)) {
    return msg;
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::/i.test(msg)) {
    return 'Couldn’t reach the update server. Check your internet connection and try again.';
  }
  if (msg.length > 200) return `${msg.slice(0, 180)}…`;
  return msg;
}

function renderInline(str: string) {
  const parts: React.ReactNode[] = [];
  let key = 0;
  const tokens = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  for (const token of tokens) {
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} className="release-strong">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={key++} className="release-code">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token) {
      parts.push(token);
    }
  }
  return parts;
}

/** Split CHANGELOG.md into per-version cards. */
function parseReleaseNotes(text: string): ReleaseNote[] {
  if (!text.trim()) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const releases: ReleaseNote[] = [];
  let current: ReleaseNote | null = null;
  let section: ReleaseSection | null = null;

  const pushSection = () => {
    if (current && section && (section.title || section.bullets.length)) {
      current.sections.push(section);
    }
    section = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('# ') && !line.startsWith('## ')) continue;

    const versionMatch = line.match(/^##\s+(\d+\.\d+(?:\.\d+)?)(?:\s*[-–-]\s*(.+))?$/);
    if (versionMatch) {
      pushSection();
      if (current) releases.push(current);
      current = {
        version: versionMatch[1].trim(),
        date: (versionMatch[2] || '').trim(),
        sections: [],
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith('### ')) {
      pushSection();
      section = { title: line.slice(4).trim(), bullets: [] };
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      if (!section) section = { title: '', bullets: [] };
      section.bullets.push(line.slice(2).trim());
      continue;
    }
  }
  pushSection();
  if (current) releases.push(current);
  return releases;
}

function sectionIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('fix')) return I.check;
  if (t.includes('improve') || t.includes('polish') || t.includes('ux')) return I.sparkles;
  if (t.includes('light') || t.includes('low-end') || t.includes('packag')) return I.cpu;
  if (t.includes('feature') || t.includes('key')) return I.flag;
  return I.list;
}

/** Format changelog dates as en-IN; keep labels like "in progress" as-is. */
function formatReleaseDate(raw: string): string {
  const iso = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return raw;
  return parseIsoDate(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function UpdatesPage() {
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('We’ll let you know when something new is available.');
  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);
  const [macAssist, setMacAssist] = useState<{
    unsigned: boolean;
    xattrCommand: string;
    dmgUrl: string;
  } | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);

  const releases = useMemo(() => parseReleaseNotes(changelog), [changelog]);

  useEffect(() => {
    void api.changelog().then(setChangelog);

    if (isUpdateUiPreview()) {
      setVersion(UPDATE_PREVIEW.currentVersion);
      setAvailableVersion(UPDATE_PREVIEW.nextVersion);
      setPhase('available');
      setMessage(
        `Preview mode: pretend ${UPDATE_PREVIEW.nextVersion} is available. Click “Check for updates” to simulate download.`,
      );
      return;
    }

    void api.getVersion().then(setVersion);
    void api.getMacAssist().then((a) => {
      if (a.unsigned) setMacAssist(a);
    });
    void api.updaterStatus().then((s) => {
      if (s.ready) {
        setPhase('ready');
        setMessage('An update is downloaded and ready. Restart to finish installing.');
      } else if (s.error) {
        setPhase(
          /not configured|not set up|YOUR_GITHUB|packaged install|Updater did not run|unsigned/i.test(s.error)
            ? 'unavailable'
            : 'error',
        );
        setMessage(s.error);
      }
    });
    const off = window.wtt?.on('updater:event', (evt) => {
      const e = evt as {
        type: string;
        progress?: { percent: number };
        message?: string;
        info?: { version?: string };
      };
      if (e.type === 'available') {
        setPhase('downloading');
        if (e.info?.version) setAvailableVersion(e.info.version);
        const v = e.info?.version ? ` (${e.info.version})` : '';
        setMessage(`A newer version was found${v}. Downloading in the background…`);
      }
      if (e.type === 'not-available') {
        setPhase('up-to-date');
        setMessage('You’re on the latest version.');
      }
      if (e.type === 'progress') {
        setPhase('downloading');
        const pct = Math.round(e.progress?.percent || 0);
        setProgress(pct);
        setMessage(`Downloading update… ${pct}%`);
      }
      if (e.type === 'downloaded') {
        setPhase('ready');
        setProgress(100);
        if (e.info?.version) setAvailableVersion(e.info.version);
        setMessage('Update ready. Restart the app to install it.');
      }
      if (e.type === 'error') {
        const friendly = friendlyEventError(e.message);
        setPhase(
          /not set up|not configured|packaged install|Updater did not run|unsigned/i.test(friendly)
            ? 'unavailable'
            : 'error',
        );
        setMessage(friendly);
      }
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    if (!availableVersion || !macAssist) return;
    void api.getMacAssist(availableVersion).then((a) => setMacAssist(a));
  }, [availableVersion]);

  const getStatusColor = () => {
    if (phase === 'ready') return 'var(--status-done)';
    if (phase === 'error') return 'var(--priority-high)';
    if (phase === 'unavailable') return 'var(--status-none)';
    if (phase === 'checking' || phase === 'downloading' || phase === 'available') return 'var(--accent)';
    return 'var(--status-done)';
  };

  const getStatusLabel = () => {
    if (phase === 'ready') return 'Ready to install';
    if (phase === 'available') return 'Update available';
    if (phase === 'up-to-date') return 'Up to date';
    if (phase === 'downloading') return 'Downloading update';
    if (phase === 'checking') return 'Checking…';
    if (phase === 'unavailable') return 'Offline mode';
    if (phase === 'error') return 'Check failed';
    return 'Up to date';
  };

  async function onCheck() {
    setChecking(true);
    setPhase('checking');
    setMessage('Looking for a newer version…');

    if (isUpdateUiPreview()) {
      setAvailableVersion(UPDATE_PREVIEW.nextVersion);
      setPhase('downloading');
      setProgress(0);
      setMessage(`Preview: downloading Daybook ${UPDATE_PREVIEW.nextVersion}…`);
      setChecking(false);
      runMockUpdateDownload(
        (pct) => {
          setProgress(pct);
          setMessage(`Preview: downloading update… ${pct}%`);
        },
        () => {
          setPhase('ready');
          setProgress(100);
          setMessage(`Preview: Daybook ${UPDATE_PREVIEW.nextVersion} ready. Restart & install is mocked.`);
        },
      );
      return;
    }

    try {
      const res = await api.checkUpdates();
      if (!res.ok) {
        const err = res.error || 'Check failed';
        setPhase(
          /not set up|not configured|provided one|packaged install|Updater did not run/i.test(err)
            ? 'unavailable'
            : 'error',
        );
        setMessage(err);
      } else if (res.ready) {
        setPhase('ready');
        setMessage(res.message || 'An update is ready to install.');
      } else if (res.isUpdateAvailable) {
        const downloading = /downloading/i.test(res.message || '');
        setPhase(downloading ? 'downloading' : 'available');
        setMessage(res.message || 'Update found.');
      } else {
        setPhase('up-to-date');
        setMessage(res.message || 'You’re on the latest version.');
      }
    } catch (err) {
      setPhase('error');
      setMessage(err instanceof Error ? err.message : 'Check failed');
    }
    setChecking(false);
  }

  const latestNotes = releases[0]?.version || '—';
  const statusColor = getStatusColor();
  const statusLabel = getStatusLabel();
  const heroTone =
    phase === 'ready'
      ? 'is-ready'
      : phase === 'error'
        ? 'is-error'
        : phase === 'available' || phase === 'downloading'
          ? 'is-available'
          : '';

  return (
    <div className="page page-updates animate-fade-in">
      <header className={`updates-hero ${heroTone}`.trim()}>
        <div className="updates-hero-copy">
          <p className="updates-kicker">Updates</p>
          <h1>{statusLabel}</h1>
          <p className="updates-sub">{message}</p>
        </div>
        <div className="updates-hero-actions">
          <span
            className="update-status-pill"
            style={{
              color: statusColor,
              background: `${statusColor}18`,
              borderColor: `${statusColor}33`,
            }}
          >
            <span className="update-status-dot-pulse" style={{ backgroundColor: statusColor }} />
            {version ? `v${version.replace(/^v/i, '')}` : '—'}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={checking || phase === 'downloading'}
            onClick={() => void onCheck()}
          >
            <Icon
              icon={I.refresh}
              width={15}
              style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }}
            />
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          {phase === 'ready' && !macAssist ? (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                if (isUpdateUiPreview()) {
                  setMessage('Preview only — Restart & install is mocked (app will not quit).');
                  return;
                }
                const res = await api.installUpdate();
                if (!res.ok) setMessage(res.error || 'No update is ready yet.');
              }}
            >
              <Icon icon={I.download} width={15} />
              Restart & install
            </button>
          ) : null}
        </div>
        {phase === 'downloading' ? (
          <div className="update-download-bar">
            <div className="update-download-meta">
              <span>Downloading package</span>
              <strong>{progress}%</strong>
            </div>
            <div
              className="update-download-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span className="update-download-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
        {macAssist ? (
          <div className="mac-assist-panel">
            <p className="field-hint">Automatic update isn’t available for this Mac build yet (unsigned).</p>
            <ol className="update-mac-steps">
              <li>Open the DMG and replace Daybook in Applications.</li>
              <li>If macOS blocks the app, open Terminal and run:</li>
            </ol>
            <pre className="update-xattr-code">{macAssist.xattrCommand}</pre>
            <div className="updates-mac-actions">
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(macAssist.xattrCommand);
                  setMessage('xattr command copied');
                }}
              >
                <Icon icon={I.copy} width={14} /> Copy command
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void api.openExternal(macAssist.dmgUrl)}>
                <Icon icon={I.download} width={14} /> Download DMG
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <section className="updates-metrics" aria-label="Version summary">
        <div className="updates-metric">
          <span className="updates-metric-label">Installed</span>
          <strong className="updates-metric-value">{version || '—'}</strong>
          <span className="updates-metric-hint">This build</span>
        </div>
        <div className="updates-metric">
          <span className="updates-metric-label">Status</span>
          <strong className="updates-metric-value updates-metric-value--sm">{statusLabel}</strong>
          <span className="updates-metric-hint">{phase === 'ready' ? 'Restart to finish' : 'Desktop updater'}</span>
        </div>
        <div className="updates-metric">
          <span className="updates-metric-label">Latest notes</span>
          <strong className="updates-metric-value">{latestNotes}</strong>
          <span className="updates-metric-hint">
            {availableVersion ? `Available: ${availableVersion}` : `${releases.length} versions on file`}
          </span>
        </div>
      </section>

      <section className="updater-releases" aria-label="Release notes">
        <div className="updater-releases-head">
          <div>
            <h2>Release notes</h2>
            <p>What shipped in each Daybook build</p>
          </div>
          <span className="updater-releases-count">{releases.length} versions</span>
        </div>

        {!releases.length ? (
          <div className="release-card release-card--empty">
            <Icon icon={I.info} width={22} />
            <p>No release notes available for this install.</p>
          </div>
        ) : (
          <Scrollbar className="updater-releases-scroll" orientation="vertical" autoHide aria-label="Release notes">
            <div className="release-card-stack">
              {releases.map((rel, idx) => {
                const isCurrent =
                  Boolean(version) &&
                  rel.version.replace(/^v/i, '').startsWith(version.replace(/^v/i, ''));
                return (
                  <article
                    key={`${rel.version}-${idx}`}
                    className={`release-card${isCurrent ? ' release-card--current' : ''}${idx === 0 ? ' release-card--latest' : ''}`}
                  >
                    <header className="release-card-header">
                      <div className="release-card-icon" aria-hidden>
                        <Icon icon={isCurrent ? I.success : I.layers} width={18} />
                      </div>
                      <div className="release-card-titles">
                        <div className="release-card-title-row">
                          <h3>{rel.version}</h3>
                          {isCurrent && <span className="release-badge">Installed</span>}
                          {idx === 0 && !isCurrent && (
                            <span className="release-badge release-badge--new">Latest notes</span>
                          )}
                        </div>
                        {rel.date ? <p className="release-card-date">{formatReleaseDate(rel.date)}</p> : null}
                      </div>
                    </header>
                    <div className="release-card-body">
                      {rel.sections.map((sec, sIdx) => (
                        <div key={`${rel.version}-s-${sIdx}`} className="release-section">
                          {sec.title ? (
                            <h4 className="release-section-title">
                              <Icon icon={sectionIcon(sec.title)} width={14} />
                              {sec.title}
                            </h4>
                          ) : null}
                          {sec.bullets.length > 0 && (
                            <ul className="release-bullets">
                              {sec.bullets.map((b, bIdx) => (
                                <li key={bIdx}>{renderInline(b)}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </Scrollbar>
        )}
      </section>
    </div>
  );
}
