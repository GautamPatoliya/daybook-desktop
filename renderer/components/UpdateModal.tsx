'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { Icon, I } from '../lib/icons';
import {
  getMacAssistPreview,
  isUpdateUiPreview,
  runMockUpdateDownload,
  UPDATE_PREVIEW,
} from '../lib/updatePreview';

type ModalState =
  | { kind: 'hidden' }
  | {
      kind: 'available';
      version: string;
      current: string;
      downloading?: boolean;
      progress?: number;
      platform: string;
    }
  | { kind: 'ready'; version: string; current: string; platform: string }
  | {
      kind: 'mac-assist';
      version: string;
      current: string;
      dmgUrl: string;
      xattrCommand: string;
      error?: string;
    };

const DISMISS_KEY = 'daybook-update-dismissed-session';

export function UpdateModal() {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<ModalState>({ kind: 'hidden' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith('/onboarding')) return;

    if (isUpdateUiPreview()) {
      sessionStorage.removeItem(DISMISS_KEY);

      if (UPDATE_PREVIEW.platform === 'darwin') {
        const assist = getMacAssistPreview();
        setState({
          kind: 'mac-assist',
          version: UPDATE_PREVIEW.nextVersion,
          current: UPDATE_PREVIEW.currentVersion,
          dmgUrl: assist.dmgUrl,
          xattrCommand: assist.xattrCommand,
        });
        return;
      }

      setState({
        kind: 'available',
        version: UPDATE_PREVIEW.nextVersion,
        current: UPDATE_PREVIEW.currentVersion,
        downloading: true,
        progress: 0,
        platform: UPDATE_PREVIEW.platform,
      });
      const stopMock = runMockUpdateDownload(
        (progress) => {
          setState((prev) =>
            prev.kind === 'available' ? { ...prev, downloading: true, progress } : prev,
          );
        },
        () => {
          setState({
            kind: 'ready',
            version: UPDATE_PREVIEW.nextVersion,
            current: UPDATE_PREVIEW.currentVersion,
            platform: UPDATE_PREVIEW.platform,
          });
        },
      );
      return () => stopMock();
    }

    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1') {
      return;
    }

    let cancelled = false;

    async function runLaunchCheck() {
      try {
        const launch = await api.checkUpdatesOnLaunch();
        if (cancelled || launch.deferred || !launch.packaged) return;

        const assist = await api.getMacAssist(launch.updateInfo?.version);
        const isMac = launch.platform === 'darwin' || assist.unsigned;

        if (isMac && launch.isUpdateAvailable) {
          const ver = launch.updateInfo?.version || 'latest';
          const assistForVer = await api.getMacAssist(ver === 'latest' ? undefined : ver);
          setState({
            kind: 'mac-assist',
            version: ver,
            current: launch.version || '',
            dmgUrl: assistForVer.dmgUrl,
            xattrCommand: assistForVer.xattrCommand,
            error: launch.ok ? undefined : launch.error || undefined,
          });
          return;
        }

        if (launch.ready && launch.updateInfo?.version) {
          setState({
            kind: 'ready',
            version: launch.updateInfo.version,
            current: launch.version || '',
            platform: launch.platform || '',
          });
          return;
        }

        if (launch.ok && launch.isUpdateAvailable && launch.updateInfo?.version) {
          setState({
            kind: 'available',
            version: launch.updateInfo.version,
            current: launch.version || '',
            downloading: true,
            platform: launch.platform || '',
          });
        }
      } catch {
        /* ignore */
      }
    }

    void runLaunchCheck();

    const off = window.wtt?.on('updater:event', (evt) => {
      const e = evt as {
        type: string;
        info?: { version?: string };
        progress?: { percent: number };
      };
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
      if (e.type === 'available' && e.info?.version) {
        setState((prev) => {
          if (prev.kind === 'mac-assist') return prev;
          return {
            kind: 'available',
            version: e.info!.version!,
            current: prev.kind === 'available' || prev.kind === 'ready' ? prev.current : '',
            downloading: true,
            platform: prev.kind === 'available' || prev.kind === 'ready' ? prev.platform : '',
          };
        });
      }
      if (e.type === 'progress') {
        setState((prev) =>
          prev.kind === 'available'
            ? { ...prev, downloading: true, progress: Math.round(e.progress?.percent || 0) }
            : prev,
        );
      }
      if (e.type === 'downloaded' && e.info?.version) {
        setState((prev) => {
          if (prev.kind === 'mac-assist') return prev;
          return {
            kind: 'ready',
            version: e.info!.version!,
            current: prev.kind !== 'hidden' ? prev.current : '',
            platform: prev.kind === 'available' || prev.kind === 'ready' ? prev.platform : '',
          };
        });
      }
    });

    return () => {
      cancelled = true;
      off?.();
    };
  }, [pathname]);

  if (!mounted || state.kind === 'hidden' || pathname?.startsWith('/onboarding')) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setState({ kind: 'hidden' });
  }

  async function copyXattr(cmd: string) {
    try {
      await navigator.clipboard.writeText(cmd);
      setToast('Command copied');
      window.setTimeout(() => setToast(null), 2000);
    } catch {
      setToast('Could not copy');
    }
  }

  const isDownloading = state.kind === 'available' && Boolean(state.downloading);
  const isReady = state.kind === 'ready';
  const isMac = state.kind === 'mac-assist';
  const progress = state.kind === 'available' ? state.progress ?? 0 : isReady ? 100 : 0;
  const nextVersion = state.version;
  const currentVersion = state.current;

  const headline = isMac
    ? 'Install on Mac'
    : isReady
      ? 'Update ready to install'
      : isDownloading
        ? 'Downloading update'
        : 'Update available';

  const subcopy = isMac
    ? 'Download the DMG, then replace Daybook in Applications. Your data stays on this Mac.'
    : isReady
      ? 'Restart when you’re ready — your work stays on this PC.'
      : isDownloading
        ? 'You can keep working. We’ll notify you when it’s ready.'
        : 'A newer Daybook build is available.';

  const macCmd = isMac ? state.xattrCommand : '';
  const macDmg = isMac ? state.dmgUrl : '';

  const modal = (
    <>
      <div className="upd-backdrop" onClick={dismiss} aria-hidden />
      <div
        className={`upd-modal${isReady ? ' upd-modal--ready' : ''}${isMac ? ' upd-modal--mac' : ''}${isDownloading ? ' upd-modal--busy' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upd-modal-title"
      >
        <button type="button" className="upd-close" aria-label="Dismiss" onClick={dismiss}>
          <Icon icon={I.close} width={18} />
        </button>

        <div className="upd-hero" aria-hidden>
          <div
            className={`upd-hero-orb${isReady ? ' is-ready' : ''}${isMac ? ' is-mac' : ''}${isDownloading ? ' is-busy' : ''}`}
          >
            <Icon
              icon={isReady ? I.success : isDownloading ? I.download : isMac ? I.download : I.refresh}
              width={28}
            />
          </div>
          <div className="upd-hero-ring" />
        </div>

        <div className="upd-copy">
          <p className="upd-kicker">Daybook Desktop</p>
          <h2 id="upd-modal-title">{headline}</h2>
          <p className="upd-sub">{subcopy}</p>
        </div>

        <div className="upd-version-row" aria-label="Version comparison">
          <div className="upd-version-chip">
            <span className="upd-version-label">Installed</span>
            <strong>v{currentVersion || '—'}</strong>
          </div>
          <span className="upd-version-arrow" aria-hidden>
            <Icon icon={I.chevronRight} width={16} />
          </span>
          <div className="upd-version-chip upd-version-chip--next">
            <span className="upd-version-label">New</span>
            <strong>v{nextVersion || '—'}</strong>
          </div>
        </div>

        {isDownloading ? (
          <div className="upd-progress-block">
            <div className="upd-progress-meta">
              <span>Downloading package</span>
              <strong>{progress}%</strong>
            </div>
            <div
              className="upd-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span className="upd-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {isReady ? (
          <div className="upd-ready-note">
            <Icon icon={I.check} width={16} />
            <span>Package downloaded. Restart applies the update on Windows.</span>
          </div>
        ) : null}

        {isMac ? (
          <div className="upd-mac">
            {state.error ? <p className="upd-mac-error">{state.error}</p> : null}
            <div className="upd-mac-guide" aria-label="Install steps">
              <div className="upd-mac-step">
                <span className="upd-mac-step-num">1</span>
                <div className="upd-mac-step-body">
                  <strong>Install the DMG</strong>
                  <p>Open the disk image and drag Daybook into Applications, replacing the old app.</p>
                </div>
              </div>
              <div className="upd-mac-step">
                <span className="upd-mac-step-num">2</span>
                <div className="upd-mac-step-body">
                  <strong>If macOS blocks the app</strong>
                  <p>Paste this in Terminal, then reopen Daybook:</p>
                  <div className="upd-mac-code-row">
                    <code className="upd-mac-code">{macCmd}</code>
                    <button
                      type="button"
                      className="upd-mac-copy"
                      aria-label="Copy Terminal command"
                      onClick={() => void copyXattr(macCmd)}
                    >
                      <Icon icon={I.copy} width={15} />
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="upd-actions">
          <button type="button" className="upd-btn upd-btn--text" onClick={dismiss}>
            Later
          </button>
          <div className="upd-actions-end">
            <button
              type="button"
              className="upd-btn upd-btn--ghost"
              onClick={() => {
                dismiss();
                router.push('/updates/');
              }}
            >
              What’s new
            </button>
            {isReady ? (
              <button
                type="button"
                className="upd-btn upd-btn--primary"
                disabled={busy}
                onClick={async () => {
                  if (isUpdateUiPreview()) {
                    setToast('Preview only — install is mocked (no restart).');
                    window.setTimeout(() => setToast(null), 2800);
                    return;
                  }
                  setBusy(true);
                  const res = await api.installUpdate();
                  if (!res.ok) {
                    setToast(res.error || 'Install failed');
                    setBusy(false);
                  }
                }}
              >
                <Icon icon={I.refresh} width={15} />
                {busy ? 'Restarting…' : 'Restart & install'}
              </button>
            ) : isMac ? (
              <button
                type="button"
                className="upd-btn upd-btn--primary"
                onClick={() => {
                  if (isUpdateUiPreview()) {
                    setToast('Preview only — DMG open is mocked.');
                    window.setTimeout(() => setToast(null), 2800);
                    return;
                  }
                  void api.openExternal(macDmg);
                }}
              >
                <Icon icon={I.download} width={15} />
                Download DMG
              </button>
            ) : (
              <button
                type="button"
                className="upd-btn upd-btn--primary"
                disabled={isDownloading}
                onClick={() => {
                  dismiss();
                  router.push('/updates/');
                }}
              >
                {isDownloading ? 'Working…' : 'View details'}
              </button>
            )}
          </div>
        </div>
      </div>

      {toast ? (
        <div className="toast" role="status">
          <Icon icon={I.toastCheck} width={16} />
          {toast}
        </div>
      ) : null}
    </>
  );

  return createPortal(modal, document.body);
}
