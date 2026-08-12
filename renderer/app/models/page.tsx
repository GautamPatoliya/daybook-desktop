'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, I } from '../../lib/icons';
import { api } from '../../lib/api';
import type { AppSettings, ModelCatalogItem } from '../../../shared/types';

type ModelRow = ModelCatalogItem & {
  installed: boolean;
  path?: string;
  downloading: boolean;
  paused?: boolean;
  received: number;
  total: number;
  percent: number;
};

type LiveProgress = {
  received: number;
  total: number;
  percent: number;
  error?: string;
  reason?: string;
};

function sizeLabel(bytes: number) {
  const gb = bytes / 1e9;
  if (gb >= 1) return `~${Math.round(gb * 10) / 10} GB`;
  return `~${Math.round(bytes / 1e6)} MB`;
}

function formatBytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [progress, setProgress] = useState<Record<string, LiveProgress>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [engine, setEngine] = useState<{
    installed: boolean;
    version: string | null;
    installing: boolean;
    platformPackage: string | null;
  } | null>(null);
  const [enginePct, setEnginePct] = useState(0);
  const [engineBusy, setEngineBusy] = useState(false);
  const smoothRef = useRef<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const list = await api.listModels();
    setModels(list);
    setSettings(await api.getSettings());
    setEngine(await api.engineStatus());
    setProgress((prev) => {
      const next = { ...prev };
      for (const m of list) {
        if (m.downloading) {
          next[m.id] = {
            received: m.received,
            total: m.total,
            percent: m.percent,
            error: undefined,
            reason: undefined,
          };
          smoothRef.current[m.id] = m.percent;
        } else if (m.installed) {
          delete next[m.id];
          delete smoothRef.current[m.id];
        } else if (m.paused || (m.received > 0 && !m.installed)) {
          next[m.id] = {
            received: m.received,
            total: m.total,
            percent: m.percent,
            error: next[m.id]?.error,
            reason: next[m.id]?.reason || 'paused',
          };
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh();
    const offModels = window.wtt?.on('models:progress', (p) => {
      const prog = p as {
        id: string;
        received: number;
        total: number;
        done?: boolean;
        error?: string;
        percent?: number;
        reason?: string;
      };
      const pct =
        typeof prog.percent === 'number'
          ? prog.percent
          : prog.total > 0
            ? (prog.received / prog.total) * 100
            : 0;

      if (prog.done) {
        setBusyId(null);
        if (prog.reason === 'cancelled') {
          setProgress((prev) => {
            const next = { ...prev };
            delete next[prog.id];
            return next;
          });
          delete smoothRef.current[prog.id];
          setToast('Download cancelled');
          void refresh();
          return;
        }
        if (prog.reason === 'paused') {
          setProgress((prev) => ({
            ...prev,
            [prog.id]: {
              received: prog.received,
              total: prog.total,
              percent: pct,
              reason: 'paused',
            },
          }));
          setToast('Download paused — you can resume anytime');
          void refresh();
          return;
        }
        if (prog.error) {
          setProgress((prev) => ({
            ...prev,
            [prog.id]: {
              received: prog.received,
              total: prog.total,
              percent: pct,
              error: prog.error,
              reason: prog.reason,
            },
          }));
          setToast(prog.error);
          void refresh();
          return;
        }
        setProgress((prev) => {
          const next = { ...prev };
          delete next[prog.id];
          return next;
        });
        delete smoothRef.current[prog.id];
        setToast('Download complete. This model is ready to use offline.');
        void refresh();
        return;
      }

      setProgress((prev) => ({
        ...prev,
        [prog.id]: {
          received: prog.received,
          total: prog.total,
          percent: pct,
          error: undefined,
          reason: undefined,
        },
      }));
      smoothRef.current[prog.id] = pct;
    });

    const offEngine = window.wtt?.on('engine:progress', (p) => {
      const prog = p as { phase: string; percent?: number; error?: string; packageName?: string };
      setEnginePct(Math.round(prog.percent || 0));
      if (prog.phase === 'done') {
        setEngineBusy(false);
        setToast('AI engine installed. You can download a model below.');
        void refresh();
      }
      if (prog.phase === 'error') {
        setEngineBusy(false);
        setToast(prog.error || 'AI engine install failed');
        void refresh();
      }
    });

    return () => {
      offModels?.();
      offEngine?.();
    };
  }, [refresh]);

  // Poll only while a download/install is active — not every 5s forever
  const anyDownloading = models.some((m) => m.downloading) || Object.keys(progress).length > 0;
  useEffect(() => {
    if (!engineBusy && !engine?.installing && !anyDownloading) return;
    const poll = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(poll);
  }, [engineBusy, engine?.installing, anyDownloading, refresh]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Local AI</h1>
        <p className="page-sub">
          Optional. Daybook stays light by default — install the AI engine only if you want on-device
          wording polish. Models download separately and stay on this PC.
        </p>
      </div>

      <div className={`status-banner ${engine?.installed ? 'ok' : 'info'}`} style={{ marginBottom: '1rem' }}>
        <Icon icon={engine?.installed ? I.success : I.cpu} width={20} />
        <div style={{ flex: 1 }}>
          <h3>{engine?.installed ? 'AI engine ready' : 'AI engine not installed'}</h3>
          <p>
            {engine?.installed
              ? `CPU engine v${engine.version || '?'} is installed in your app data (not in the Daybook installer).`
              : 'The base Daybook installer does not include Local AI. Install a small CPU engine (~45–100 MB) when you want polish. If a previous install failed, click Install again — it will replace the broken files.'}
          </p>
          {(engineBusy || engine?.installing) && (
            <div style={{ marginTop: '0.6rem' }}>
              <div className="progress" style={{ margin: 0 }}>
                <span style={{ width: `${enginePct}%` }} />
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>Installing… {enginePct}%</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!engine?.installed ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={engineBusy || !engine?.platformPackage}
                onClick={async () => {
                  setEngineBusy(true);
                  setEnginePct(0);
                  try {
                    const res = await api.installEngine();
                    if (!res.ok) {
                      setToast(res.error || 'Install failed');
                    }
                  } finally {
                    setEngineBusy(false);
                    await refresh();
                  }
                }}
              >
                Install AI engine
              </button>
              {engineBusy && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void api.cancelEngineInstall().then(refresh)}
                >
                  Cancel
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                if (!confirm('Remove the Local AI engine from this PC? Downloaded models are kept.')) return;
                await api.uninstallEngine();
                await api.saveSettings({ aiEnhanceEnabled: false, selectedModelId: null });
                setToast('AI engine removed');
                await refresh();
              }}
            >
              Remove engine
            </button>
          )}
        </div>
      </div>

      <div className="status-banner info">
        <Icon icon={I.info} width={20} />
        <div>
          <h3>Models (optional)</h3>
          <p>
            Download a GGUF model after the engine is installed. Pause/cancel anytime. Enable “Polish
            Drafts with Local AI” in Settings when ready.
          </p>
        </div>
      </div>

      <div
        style={{
          background: 'linear-gradient(180deg, #12151d 0%, #0c0e14 100%)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          marginTop: '1.5rem',
        }}
      >
        {models.map((m, index) => {
          const live = progress[m.id];
          const downloading = m.downloading;
          const hasError = Boolean(live?.error);
          const incomplete =
            !m.installed && !downloading && ((m.paused ?? false) || (m.received > 0) || hasError);
          const pct = m.installed ? 100 : (live?.percent ?? m.percent ?? 0);
          const received = live?.received ?? m.received;
          const total = live?.total || m.total || m.sizeBytes;
          const selected = settings?.selectedModelId === m.id;
          const statusLabel = downloading
            ? `${Math.floor(pct)}% Completed`
            : hasError
              ? 'Interrupted'
              : incomplete
                ? 'Paused'
                : null;

          return (
            <div
              key={m.id}
              style={{
                borderBottom:
                  index === models.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                background: selected ? 'rgba(59, 130, 246, 0.02)' : 'transparent',
                position: 'relative',
              }}
            >
              {selected && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: 'var(--accent)',
                  }}
                />
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                      {m.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {m.recommended && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 750,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: 'rgba(59,130,246,0.15)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59,130,246,0.25)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          Recommended
                        </span>
                      )}
                      {m.installed && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 750,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: 'rgba(52,211,153,0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(52,211,153,0.25)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          Ready
                        </span>
                      )}
                      {selected && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 750,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: 'rgba(139,92,246,0.15)',
                            color: '#a78bfa',
                            border: '1px solid rgba(139,92,246,0.25)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {m.description}
                  </p>
                  {hasError && (
                    <p
                      style={{
                        margin: '0.5rem 0 0',
                        fontSize: '0.82rem',
                        color: 'var(--status-high)',
                      }}
                    >
                      {live?.error}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    minWidth: '200px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Icon icon={I.empty} width={14} />
                    <span>Size: {sizeLabel(m.sizeBytes)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Icon icon={I.cpu} width={14} />
                    <span>RAM: {m.ramHintGb}GB+</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {m.installed ? (
                    <>
                      <button
                        type="button"
                        className={`btn ${selected ? 'btn-primary' : ''}`}
                        style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem' }}
                        disabled={!engine?.installed}
                        title={
                          engine?.installed
                            ? undefined
                            : 'Install the AI engine first (banner above)'
                        }
                        onClick={async () => {
                          if (!engine?.installed) {
                            setToast('Install the AI engine first, then choose a model.');
                            return;
                          }
                          const next = await api.saveSettings({
                            selectedModelId: m.id,
                            aiEnhanceEnabled: true,
                          });
                          setSettings(next);
                          setToast(`${m.name} is now your active LLM`);
                        }}
                      >
                        {selected ? 'In Use' : 'Use for Polish'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '0.55rem', borderRadius: '8px' }}
                        title="Remove model"
                        onClick={async () => {
                          if (
                            !confirm(
                              `Remove ${m.name} from this PC? You can download it again later.`,
                            )
                          )
                            return;
                          await api.deleteModel(m.id);
                          if (selected) await api.saveSettings({ selectedModelId: null });
                          await refresh();
                        }}
                      >
                        <Icon icon={I.trash} width={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{
                          padding: '0.55rem 1.25rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                        }}
                        disabled={downloading || busyId === m.id}
                        onClick={async () => {
                          setBusyId(m.id);
                          try {
                            await api.downloadModel(m.id);
                            setToast(
                              incomplete ? 'Resuming download…' : 'Download started in the background',
                            );
                            await refresh();
                          } catch (err) {
                            setToast((err as Error).message);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        <Icon
                          icon={downloading ? I.loading : I.download}
                          width={14}
                          style={{ animation: downloading ? 'spin 1.5s linear infinite' : 'none' }}
                        />
                        {downloading ? 'Downloading…' : incomplete ? 'Resume' : 'Download'}
                      </button>
                      {downloading && (
                        <>
                          <button
                            type="button"
                            className="btn"
                            style={{
                              padding: '0.55rem 1rem',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                            }}
                            disabled={busyId === m.id}
                            onClick={async () => {
                              setBusyId(m.id);
                              try {
                                await api.pauseDownload(m.id);
                                await refresh();
                              } finally {
                                setBusyId(null);
                              }
                            }}
                          >
                            <Icon icon={I.pause} width={14} /> Pause
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{
                              padding: '0.55rem 1rem',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                            }}
                            disabled={busyId === m.id}
                            onClick={async () => {
                              setBusyId(m.id);
                              try {
                                await api.cancelDownload(m.id);
                                setProgress((prev) => {
                                  const next = { ...prev };
                                  delete next[m.id];
                                  return next;
                                });
                                await refresh();
                              } finally {
                                setBusyId(null);
                              }
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {incomplete && !downloading && (
                        <button
                          type="button"
                          className="btn"
                          style={{
                            padding: '0.55rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                          }}
                          disabled={busyId === m.id}
                          onClick={async () => {
                            if (!confirm(`Discard the partial download for ${m.name}?`)) return;
                            setBusyId(m.id);
                            try {
                              await api.cancelDownload(m.id);
                              setProgress((prev) => {
                                const next = { ...prev };
                                delete next[m.id];
                                return next;
                              });
                              await refresh();
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          Discard
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {(downloading || incomplete) && !m.installed && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{statusLabel}</span>
                    <span>
                      {formatBytes(received)} / {formatBytes(total)}
                    </span>
                  </div>
                  <div
                    className="ai-progress-track"
                    style={{
                      height: '6px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '99px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      className="ai-progress-fill"
                      style={{
                        width: `${Math.max(0.8, Math.min(100, pct))}%`,
                        height: '100%',
                        background: hasError
                          ? 'linear-gradient(90deg, #f87171, #ef4444)'
                          : 'linear-gradient(90deg, var(--accent), #3b82f6)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
