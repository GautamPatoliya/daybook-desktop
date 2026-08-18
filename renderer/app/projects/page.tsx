'use client';

import { useEffect, useState } from 'react';
import { Icon, I } from '../../lib/icons';
import { api } from '../../lib/api';
import { PROJECT_COLORS, type ProjectMeta } from '../../../shared/types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [defaultProject, setDefaultProject] = useState('General');
  const [toast, setToast] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ProjectMeta | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const s = await api.getSettings();
    setProjects(s.projects);
    setDefaultProject(s.defaultProject);
  }

  useEffect(() => {
    void refresh().catch((err) => setToast((err as Error).message));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setName('');
    setColor(PROJECT_COLORS[projects.length % PROJECT_COLORS.length]);
    setNotes('');
  }

  function openEdit(p: ProjectMeta) {
    setEditing(p);
    setCreating(false);
    setName(p.name);
    setColor(p.color);
    setNotes(p.notes || '');
  }

  async function save() {
    if (!name.trim()) {
      showToast('Enter a project name');
      return;
    }
    setBusy(true);
    try {
      if (creating) {
        const res = await api.upsertProject({ name: name.trim(), color, notes });
        setProjects(res.projects);
        showToast('Project created');
      } else if (editing) {
        const res = await api.upsertProject({
          name: name.trim(),
          color,
          notes,
          renameFrom: editing.name,
        });
        setProjects(res.projects);
        showToast('Project updated');
      }
      setCreating(false);
      setEditing(null);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const visible = projects.filter((p) => (showArchived ? p.archived : !p.archived));

  return (
    <div className="page">
      <div className="projects-header-actions">
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 850, letterSpacing: '-0.02em', margin: '0 0 0.4rem 0' }}>
            Initiatives & Projects
          </h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Organize and group tasks by client, team, or work stream. Default project is automatically selected for new tasks.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" className={`btn ${showArchived ? '' : 'btn-primary'}`} style={{ borderRadius: '99px' }} onClick={() => setShowArchived((v) => !v)}>
            <Icon icon={showArchived ? I.success : I.archive} width={16} />
            {showArchived ? 'Show active' : 'Show archived'}
          </button>
          <button type="button" className="btn btn-primary" style={{ borderRadius: '99px' }} onClick={openCreate}>
            <Icon icon={I.plus} width={16} /> New project
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: '1.20rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        {showArchived ? 'Archived Projects' : 'Active Projects'}
      </h2>

      {visible.length === 0 ? (
        <div className="empty" style={{ padding: '4rem 2rem', background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <Icon icon={I.empty} width={40} className="empty-icon" style={{ color: 'var(--text-dim)' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
            {showArchived
              ? 'No archived projects found.'
              : 'No projects logged yet. Create your first project to start organizing!'}
          </p>
        </div>
      ) : (
        <div style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          marginTop: '1rem'
        }}>
          <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
                <th style={{ padding: '1rem', width: '240px', color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes & Context</th>
                <th style={{ padding: '1rem', width: '140px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '1rem', width: '420px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 650, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const isDefault = defaultProject === p.name;
                return (
                  <tr key={p.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '1.25rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: p.color, flexShrink: 0, boxShadow: `0 0 8px ${p.color}80` }} />
                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.96rem' }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1rem', color: 'var(--text-secondary)', fontSize: '0.88rem', verticalAlign: 'middle', lineHeight: '1.4' }}>
                      {p.notes?.trim() || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No description provided.</span>}
                    </td>
                    <td style={{ padding: '1.25rem 1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      {isDefault ? (
                        <span className="project-status-badge" style={{
                          fontSize: '0.72rem',
                          fontWeight: 750,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          padding: '4px 12px',
                          background: 'rgba(var(--accent-rgb,223,42,47), 0.12)',
                          color: 'var(--accent)',
                          border: '1px solid rgba(var(--accent-rgb,223,42,47), 0.25)',
                        }}>
                          Default
                        </span>
                      ) : (
                        <span className={p.archived ? 'project-archive-badge' : 'project-active-badge'} style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          padding: '4px 12px',
                          background: p.archived ? 'rgba(255,255,255,0.03)' : 'rgba(var(--success-rgb,26,127,196), 0.1)',
                          color: p.archived ? 'var(--text-dim)' : 'var(--status-done)',
                          border: p.archived ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(var(--success-rgb,26,127,196), 0.2)'
                        }}>
                          {p.archived ? 'Archived' : 'Active'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                        {!p.archived && !isDefault && (
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: '0.45rem 1rem', fontSize: '0.84rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
                            onClick={async () => {
                              await api.saveSettings({ defaultProject: p.name });
                              setDefaultProject(p.name);
                              showToast(`${p.name} is now the default`);
                            }}
                          >
                            Make Default
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '0.45rem 1rem', fontSize: '0.84rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
                          onClick={() => openEdit(p)}
                        >
                          <Icon icon={I.edit} width={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '0.45rem 1rem', fontSize: '0.84rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
                          onClick={async () => {
                            try {
                              const res = await api.archiveProject(p.name, !p.archived);
                              setProjects(res.projects);
                              showToast(p.archived ? 'Project restored' : 'Project archived');
                            } catch (err) {
                              showToast((err as Error).message);
                            }
                          }}
                        >
                          <Icon icon={I.archive} width={13} /> {p.archived ? 'Restore' : 'Archive'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.45rem 0.8rem', borderRadius: '8px' }}
                          onClick={async () => {
                            if (!confirm(`Permanently delete “${p.name}”? Existing tasks keep the name, but the project will disappear from lists.`)) {
                              return;
                            }
                            try {
                              const res = await api.deleteProject(p.name);
                              setProjects(res.projects);
                              showToast('Project deleted');
                            } catch (err) {
                              showToast((err as Error).message);
                            }
                          }}
                        >
                          <Icon icon={I.trash} width={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <>
          <div className="overlay" onClick={() => { setCreating(false); setEditing(null); }} />
          <div className="composer" role="dialog" aria-label={creating ? 'New project' : 'Edit project'}>
            <header className="composer-header">
              <strong>{creating ? 'New project' : 'Edit project'}</strong>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={() => { setCreating(false); setEditing(null); }}
              >
                <Icon icon={I.close} width={16} />
              </button>
            </header>
            <div className="composer-body">
              <div className="field">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website redesign" autoFocus />
              </div>
              <div className="field">
                <label>Color</label>
                <div className="color-grid">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch${color === c ? ' selected' : ''}`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Notes (optional)</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who owns this? Any useful context…" />
              </div>
            </div>
            <footer className="composer-footer">
              <button type="button" className="btn" onClick={() => { setCreating(false); setEditing(null); }}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
                {busy ? 'Saving…' : creating ? 'Create project' : 'Save changes'}
              </button>
            </footer>
          </div>
        </>
      )}

      {toast && (
        <div className="toast" role="status">
          <Icon icon={I.toastCheck} width={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
