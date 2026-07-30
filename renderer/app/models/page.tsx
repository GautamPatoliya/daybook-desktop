'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { api } from '../../lib/api';
import { I } from '../../lib/icons';
import type { AppSettings, ModelCatalogItem } from '../../../shared/types';

type ModelRow = ModelCatalogItem & {
  installed: boolean;
  path?: string;
  downloading: boolean;
  received: number;
  total: number;
  percent: number;
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
  const [progress, setProgress] = useState<
    Record<string, { received: number; total: number; percent: number }>
  >({});
  const [toast, setToast] = useState<string | null>(null);
  const smoothRef = useRef<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const list = await api.listModels();
    setModels(list);
    setSettings(await api.getSettings());
    setProgress((prev) => {
      const next = { ...prev };
      for (const m of list) {
        if (m.downloading || (m.received > 0 && !m.installed)) {
          next[m.id] = { received: m.received, total: m.total, percent: m.percent };
          smoothRef.current[m.id] = m.percent;
        } else if (m.installed) {
          delete next[m.id];
          delete smoothRef.current[m.id];
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh();
    const off = window.wtt?.on('models:progress', (p) => {
      const prog = p as {
        id: string;
        received: number;
        total: number;
        done?: boolean;
        error?: string;
        percent?: number;
      };
      const pct =
        typeof prog.percent === 'number'
          ? prog.percent
          : prog.total > 0
            ? (prog.received / prog.total) * 100
            : 0;

      setProgress((prev) => ({
        ...prev,
        [prog.id]: { received: prog.received, total: prog.total, percent: pct },
      }));
      smoothRef.current[prog.id] = pct;

      if (prog.done) {
        void refresh();
        if (prog.error) setToast(prog.error);
        else setToast('Download complete. This model is ready to use offline.');
      }
    });
    const poll = window.setInterval(() => void refresh(), 4000);
    return () => {
      off?.();
      window.clearInterval(poll);
    };
  }, [refresh]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Local AI</h1>
        <p className="page-sub">
          Download an optional on-device LLM to polish your daily email wording.
          Runs offline after download — no account required. Skip this if you don’t need it.
        </p>
      </div>

      <div className="status-banner info">
        <Icon icon={I.info} width={20} />
        <div>
          <h3>Pick one and leave it running</h3>
          <p>
            Downloads continue in the background. Come back anytime to see progress.
            Start with the recommended model if you’re unsure.
          </p>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(180deg, #12151d 0%, #0c0e14 100%)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        marginTop: '1.5rem'
      }}>
        {models.map((m, index) => {
          const live = progress[m.id];
          const downloading = m.downloading || Boolean(live && !m.installed);
          const pct = m.installed
            ? 100
            : live?.percent ?? m.percent ?? 0;
          const received = live?.received ?? m.received;
          const total = live?.total || m.total || m.sizeBytes;
          const selected = settings?.selectedModelId === m.id;
          const incomplete = !m.installed && received > 0 && !downloading;

          return (
            <div
              key={m.id}
              style={{
                borderBottom: index === models.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                background: selected ? 'rgba(59, 130, 246, 0.02)' : 'transparent',
                position: 'relative'
              }}
            >
              {selected && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  background: 'var(--accent)'
                }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                {/* Model info */}
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{m.name}</h3>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {m.recommended && <span style={{ fontSize: '0.68rem', fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', padding: '2px 8px', borderRadius: '4px' }}>Recommended</span>}
                      {m.installed && <span style={{ fontSize: '0.68rem', fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)', padding: '2px 8px', borderRadius: '4px' }}>Ready</span>}
                      {selected && <span style={{ fontSize: '0.68rem', fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)', padding: '2px 8px', borderRadius: '4px' }}>Active</span>}
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{m.description}</p>
                </div>

                {/* Metadata */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <Icon icon={I.empty} width={14} />
                    <span>Size: {sizeLabel(m.sizeBytes)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <Icon icon={I.cpu} width={14} />
                    <span>RAM: {m.ramHintGb}GB+</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {m.installed ? (
                    <>
                      <button
                        type="button"
                        className={`btn ${selected ? 'btn-primary' : ''}`}
                        style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem' }}
                        onClick={async () => {
                          const next = await api.saveSettings({ selectedModelId: m.id });
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
                          if (!confirm(`Remove ${m.name} from this PC? You can download it again later.`)) return;
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
                        style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem' }}
                        disabled={downloading}
                        onClick={async () => {
                          try {
                            await api.downloadModel(m.id);
                            setToast(incomplete ? 'Resuming download…' : 'Download started in the background');
                            await refresh();
                          } catch (err) {
                            setToast((err as Error).message);
                          }
                        }}
                      >
                        <Icon icon={downloading ? I.loading : I.download} width={14} style={{ animation: downloading ? 'spin 1.5s linear infinite' : 'none' }} />
                        {downloading ? 'Downloading…' : incomplete ? 'Resume' : 'Download'}
                      </button>
                      {downloading && (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '0.55rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}
                          onClick={() => void api.cancelDownload(m.id).then(refresh)}
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Progress */}
              {(downloading || incomplete) && !m.installed && (
                <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600 }}>{incomplete ? 'Paused' : `${Math.floor(pct)}% Completed`}</span>
                    <span>{formatBytes(received)} / {formatBytes(total)}</span>
                  </div>
                  <div className="ai-progress-track" style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div
                      className="ai-progress-fill"
                      style={{ width: `${Math.max(0.8, Math.min(100, pct))}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #3b82f6)' }}
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
