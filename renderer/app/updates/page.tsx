'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon, I } from '../../lib/icons';
import { api } from '../../lib/api';

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

    const versionMatch = line.match(/^##\s+(\d+\.\d+(?:\.\d+)?)(?:\s*[—–-]\s*(.+))?$/);
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

export default function UpdatesPage() {
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('We’ll let you know when something new is available.');
  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);

  const releases = useMemo(() => parseReleaseNotes(changelog), [changelog]);

  useEffect(() => {
    void api.getVersion().then(setVersion);
    void api.changelog().then(setChangelog);
    void api.updaterStatus().then((s) => {
      if (s.ready) {
        setPhase('ready');
        setMessage('An update is downloaded and ready. Restart to finish installing.');
      } else if (s.error) {
        setPhase(
          /not configured|not set up|YOUR_GITHUB|packaged install|Updater did not run/i.test(s.error)
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
        setMessage('Update ready. Restart the app to install it.');
      }
      if (e.type === 'error') {
        const friendly = friendlyEventError(e.message);
        setPhase(
          /not set up|not configured|packaged install|Updater did not run/i.test(friendly)
            ? 'unavailable'
            : 'error',
        );
        setMessage(friendly);
      }
    });
    return () => off?.();
  }, []);

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

  return (
    <div className="page page-updates">
      <div className="page-header">
        <h1>Updates</h1>
        <p className="page-sub">Check for new builds and read what changed in each release.</p>
      </div>

      <div className="updater-layout">
        <aside className="update-status-card">
          <div className="version-badge-container">
            <div className="version-badge-pulse" style={{ backgroundColor: getStatusColor() }} />
            <div
              className="version-badge-main"
              style={{ background: `linear-gradient(135deg, ${getStatusColor()}, var(--status-done))` }}
            >
              {version || '—'}
            </div>
          </div>

          <h2 className="update-status-title">Daybook Desktop</h2>

          <div
            className="update-status-pill"
            style={{
              color: getStatusColor(),
              background: `${getStatusColor()}15`,
              borderColor: `${getStatusColor()}25`,
            }}
          >
            <span className="update-status-dot-pulse" style={{ backgroundColor: getStatusColor() }} />
            {getStatusLabel()}
          </div>

          <p className="update-status-msg">{message}</p>

          <div className="update-status-actions">
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
              disabled={checking || phase === 'downloading'}
              onClick={async () => {
                setChecking(true);
                setPhase('checking');
                setMessage('Looking for a newer version…');
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
              }}
            >
              <Icon
                icon={I.refresh}
                width={16}
                style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }}
              />
              {checking ? 'Checking…' : 'Check for updates'}
            </button>

            {phase === 'ready' && (
              <button
                type="button"
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '0.65rem',
                  background: 'linear-gradient(135deg, var(--status-done), var(--success))',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
                onClick={async () => {
                  const res = await api.installUpdate();
                  if (!res.ok) setMessage(res.error || 'No update is ready yet.');
                }}
              >
                <Icon icon={I.success} width={16} />
                Restart & install
              </button>
            )}
          </div>

          {phase === 'downloading' && (
            <div className="update-download-bar">
              <div className="update-download-meta">
                <span>Downloading…</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress" style={{ margin: 0 }}>
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </aside>

        <section className="updater-releases" aria-label="Release notes">
          <div className="updater-releases-head">
            <Icon icon={I.empty} width={18} />
            <h2>Release notes</h2>
            <span className="updater-releases-count">{releases.length} versions</span>
          </div>

          {!releases.length ? (
            <div className="release-card release-card--empty">
              <Icon icon={I.info} width={22} />
              <p>No release notes available for this install.</p>
            </div>
          ) : (
            <div className="release-card-stack">
              {releases.map((rel, idx) => {
                const isCurrent =
                  Boolean(version) &&
                  rel.version.replace(/^v/i, '').startsWith(version.replace(/^v/i, ''));
                return (
                  <article
                    key={`${rel.version}-${idx}`}
                    className={`release-card${isCurrent ? ' release-card--current' : ''}`}
                  >
                    <header className="release-card-header">
                      <div className="release-card-icon" aria-hidden>
                        <Icon icon={isCurrent ? I.success : I.layers} width={18} />
                      </div>
                      <div className="release-card-titles">
                        <div className="release-card-title-row">
                          <h3>{rel.version}</h3>
                          {isCurrent && <span className="release-badge">Installed</span>}
                          {idx === 0 && !isCurrent && <span className="release-badge release-badge--new">Latest notes</span>}
                        </div>
                        {rel.date ? <p className="release-card-date">{rel.date}</p> : null}
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
          )}
        </section>
      </div>
    </div>
  );
}
