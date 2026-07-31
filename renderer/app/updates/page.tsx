'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { api } from '../../lib/api';
import { I } from '../../lib/icons';

type Phase = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error' | 'unavailable';

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

function parseMarkdown(text: string) {
  if (!text) return <p className="page-sub">No release notes available.</p>;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let inList = false;

  const renderText = (str: string) => {
    const parts: React.ReactNode[] = [];
    let key = 0;
    const tokens = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    for (const token of tokens) {
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={key++} style={{ color: 'var(--text)', fontWeight: 650 }}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={key++} style={{
            fontFamily: 'monospace',
            background: 'rgba(255,255,255,0.06)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.85em',
            border: '1px solid var(--border)',
            color: 'var(--accent)'
          }}>
            {token.slice(1, -1)}
          </code>
        );
      } else if (token) {
        parts.push(token);
      }
    }
    return parts;
  };

  const flushList = (key: number) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} style={{
          paddingLeft: '1.2rem',
          margin: '0.4rem 0 1rem 0',
          listStyleType: 'disc',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}>
          {[...currentList]}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(index);
      inList = false;
      return;
    }

    if (trimmed.startsWith('# ')) {
      flushList(index);
      inList = false;
      elements.push(
        <h1 key={index} style={{
          fontSize: '1.5rem',
          fontWeight: 750,
          color: 'var(--text)',
          margin: '1.6rem 0 0.8rem 0',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.4rem',
          letterSpacing: '-0.02em'
        }}>
          {renderText(trimmed.slice(2))}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList(index);
      inList = false;
      elements.push(
        <h2 key={index} style={{
          fontSize: '1.2rem',
          fontWeight: 650,
          color: 'var(--text)',
          margin: '1.4rem 0 0.6rem 0',
          letterSpacing: '-0.01em'
        }}>
          {renderText(trimmed.slice(3))}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      flushList(index);
      inList = false;
      elements.push(
        <h3 key={index} style={{
          fontSize: '1.05rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          margin: '1.2rem 0 0.5rem 0'
        }}>
          {renderText(trimmed.slice(4))}
        </h3>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      inList = true;
      currentList.push(
        <li key={`li-${index}`} style={{
          color: 'var(--text-secondary)',
          fontSize: '0.88rem',
          lineHeight: '1.5'
        }}>
          {renderText(trimmed.slice(2))}
        </li>
      );
    } else {
      flushList(index);
      inList = false;
      elements.push(
        <p key={index} style={{
          fontSize: '0.88rem',
          lineHeight: '1.65',
          color: 'var(--text-secondary)',
          margin: '0 0 0.8rem 0'
        }}>
          {renderText(trimmed)}
        </p>
      );
    }
  });

  flushList(lines.length);
  return elements;
}

export default function UpdatesPage() {
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('We’ll let you know when something new is available.');
  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void api.getVersion().then(setVersion);
    void api.changelog().then(setChangelog);
    void api.updaterStatus().then((s) => {
      if (s.ready) {
        setPhase('ready');
        setMessage('An update is downloaded and ready. Restart to finish installing.');
      } else if (s.error) {
        setPhase(/not configured|not set up|YOUR_GITHUB|packaged install|Updater did not run/i.test(s.error) ? 'unavailable' : 'error');
        setMessage(s.error);
      }
    });
    const off = window.wtt?.on('updater:event', (evt) => {
      const e = evt as { type: string; progress?: { percent: number }; message?: string; info?: { version?: string } };
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
        setPhase(/not set up|not configured|packaged install|Updater did not run/i.test(friendly) ? 'unavailable' : 'error');
        setMessage(friendly);
      }
    });
    return () => off?.();
  }, []);

  const getStatusColor = () => {
    if (phase === 'ready') return 'var(--status-done)';
    if (phase === 'error') return 'var(--status-high)';
    if (phase === 'unavailable') return 'var(--status-none)';
    if (phase === 'checking' || phase === 'downloading' || phase === 'available') return 'var(--accent)';
    return 'var(--status-done)'; // up-to-date
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
    <div className="page">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1>Updates & Version Control</h1>
        <p className="page-sub">
          Keep your local installation updated to ensure maximum productivity and access to all offline AI models.
        </p>
      </div>

      <div className="updater-container">
        {/* Left Side: Status / Action Panel */}
        <aside className="update-card-left">
          <div className="version-badge-container">
            <div className="version-badge-pulse" style={{ backgroundColor: getStatusColor() }} />
            <div className="version-badge-main" style={{ background: `linear-gradient(135deg, ${getStatusColor()}, #38bdf8)` }}>
              {version || '1.0.0'}
            </div>
          </div>
          
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
            Daybook Desktop
          </h2>
          
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '0.82rem',
            fontWeight: 650,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: getStatusColor(),
            background: `${getStatusColor()}15`,
            padding: '4px 12px',
            borderRadius: '99px',
            border: `1px solid ${getStatusColor()}25`,
            marginBottom: '1.5rem'
          }}>
            <span className="update-status-dot-pulse" style={{ backgroundColor: getStatusColor() }} />
            {getStatusLabel()}
          </div>

          <p style={{
            fontSize: '0.85rem',
            lineHeight: '1.5',
            color: 'var(--text-muted)',
            margin: '0 0 2rem 0',
            maxWidth: '240px'
          }}>
            {message}
          </p>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
              <Icon icon={I.refresh} width={16} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
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
                  background: 'linear-gradient(135deg, var(--status-done), #10b981)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#fff'
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
            <div style={{ width: '100%', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                <span>Downloading update...</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress" style={{ margin: 0 }}>
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </aside>

        {/* Right Side: Changelog Panel */}
        <section className="updates-changelog-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <Icon icon={I.empty} width={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Release Notes</h2>
          </div>
          <div style={{ paddingRight: '0.5rem' }}>
            {parseMarkdown(changelog)}
          </div>
        </section>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
