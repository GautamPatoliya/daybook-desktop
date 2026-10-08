'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon, I } from '../../lib/icons';
import { api } from '../../lib/api';
import SpideyLoader from '../../components/SpideyLoader';
import { useDialog } from '../../components/DialogProvider';
import { Input } from '../../components/ui/input';
import { Scrollbar } from '../../components/Scrollbar';
import { PROJECT_COLORS, type ProjectMeta } from '../../../shared/types';

export default function ProjectsPage() {
  const { confirm } = useDialog();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [defaultProject, setDefaultProject] = useState('General');
  const [toast, setToast] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ProjectMeta | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const s = await api.getSettings();
    setProjects(s.projects);
    setDefaultProject(s.defaultProject);
  }

  useEffect(() => {
    void refresh()
      .then(() => setError(null))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoaded(true));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }

  function closeComposer() {
    setCreating(false);
    setEditing(null);
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
      closeComposer();
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const activeCount = projects.filter((p) => !p.archived).length;
  const archivedCount = projects.filter((p) => p.archived).length;
  const defaultMeta = projects.find((p) => p.name === defaultProject && !p.archived);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (showArchived ? !p.archived : p.archived) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.notes || '').toLowerCase().includes(q);
    });
  }, [projects, showArchived, query]);

  if (!loaded) {
    return (
      <div className="page pj-loading">
        <SpideyLoader label="Loading projects…" />
      </div>
    );
  }

  if (error && !projects.length) {
    return (
      <div className="page">
        <div className="pj-hero">
          <div className="pj-hero-copy">
            <p className="pj-kicker">Projects</p>
            <h1>Couldn’t load projects</h1>
            <p className="pj-sub" style={{ color: 'var(--status-high)' }}>
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page pj-page animate-fade-in">
      <header className="pj-hero">
        <div className="pj-hero-copy">
          <p className="pj-kicker">Projects</p>
          <h1>Initiatives</h1>
          <p className="pj-sub">
            Group work by client, team, or stream. The default project is pre-selected when you add a task.
          </p>
        </div>
        <div className="pj-hero-actions">
          <div className="pj-tabs" role="tablist" aria-label="Project list">
            <button
              type="button"
              role="tab"
              aria-selected={!showArchived}
              className={`pj-tab${!showArchived ? ' is-active' : ''}`}
              onClick={() => setShowArchived(false)}
            >
              Active
              <span className="pj-tab-count">{activeCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showArchived}
              className={`pj-tab${showArchived ? ' is-active' : ''}`}
              onClick={() => setShowArchived(true)}
            >
              Archived
              <span className="pj-tab-count">{archivedCount}</span>
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon icon={I.plus} width={15} />
            New project
          </button>
        </div>
      </header>

      <section className="pj-panel">
        <div className="pj-panel-head">
          <div>
            <h2>{showArchived ? 'Archived' : 'Active projects'}</h2>
            <p>
              {defaultMeta ? (
                <>
                  Default for new tasks: <strong>{defaultMeta.name}</strong>
                </>
              ) : (
                'Set a default so new tasks land in the right stream.'
              )}
            </p>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search projects"
            className="pj-search"
          />
        </div>

        {visible.length === 0 ? (
          <div className="pj-empty">
            <Icon icon={I.projects} width={36} />
            <h2>{query.trim() ? 'No matches' : showArchived ? 'Nothing archived' : 'No projects yet'}</h2>
            <p>
              {query.trim()
                ? 'Try a different name or note.'
                : showArchived
                  ? 'Archive a project when that stream is done — you can restore it later.'
                  : 'Create a project to group tasks by client, team, or work stream.'}
            </p>
            {!showArchived && !query.trim() ? (
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <Icon icon={I.plus} width={15} />
                New project
              </button>
            ) : null}
          </div>
        ) : (
          <Scrollbar
            className="pj-list-scroll"
            orientation="vertical"
            autoHide
            stretchContent={false}
            aria-label={showArchived ? 'Archived projects' : 'Active projects'}
          >
            <ul className="pj-list">
              {visible.map((p) => {
                const isDefault = defaultProject === p.name && !p.archived;
                const note = p.notes?.trim();
                return (
                  <li
                    key={p.name}
                    className={`pj-row${isDefault ? ' is-default' : ''}${p.archived ? ' is-archived' : ''}`}
                  >
                    <span className="pj-swatch" style={{ background: p.color }} aria-hidden />
                    <div className="pj-row-copy">
                      <span className="pj-row-name" title={p.name}>
                        {p.name}
                      </span>
                      {note ? (
                        <span className="pj-row-notes" title={note}>
                          {note}
                        </span>
                      ) : null}
                    </div>
                    <div className="pj-row-end">
                      {isDefault ? (
                        <span className="pj-badge pj-badge--default">Default</span>
                      ) : p.archived ? (
                        <span className="pj-badge pj-badge--archived">Archived</span>
                      ) : null}
                      <div className="pj-row-actions" role="group" aria-label={`${p.name} actions`}>
                        {!p.archived && !isDefault ? (
                          <button
                            type="button"
                            className="pj-icon-btn"
                            aria-label={`Make ${p.name} the default`}
                            title="Make default"
                            onClick={async () => {
                              await api.saveSettings({ defaultProject: p.name });
                              setDefaultProject(p.name);
                              showToast(`${p.name} is now the default`);
                            }}
                          >
                            <Icon icon={I.flag} width={16} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="pj-icon-btn"
                          aria-label={`Edit ${p.name}`}
                          title="Edit"
                          onClick={() => openEdit(p)}
                        >
                          <Icon icon={I.edit} width={16} />
                        </button>
                        <button
                          type="button"
                          className="pj-icon-btn"
                          aria-label={p.archived ? `Restore ${p.name}` : `Archive ${p.name}`}
                          title={p.archived ? 'Restore' : 'Archive'}
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
                          <Icon icon={p.archived ? I.refresh : I.archive} width={16} />
                        </button>
                        <span className="pj-actions-sep" aria-hidden />
                        <button
                          type="button"
                          className="pj-icon-btn pj-icon-btn--danger"
                          aria-label={`Delete ${p.name}`}
                          title="Delete"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Delete project',
                              message: `Permanently delete “${p.name}”? Existing tasks keep the name, but the project will disappear from lists.`,
                              confirmLabel: 'Delete project',
                              variant: 'danger',
                            });
                            if (!ok) return;
                            try {
                              const res = await api.deleteProject(p.name);
                              setProjects(res.projects);
                              showToast('Project deleted');
                            } catch (err) {
                              showToast((err as Error).message);
                            }
                          }}
                        >
                          <Icon icon={I.trash} width={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Scrollbar>
        )}
      </section>

      {(creating || editing) && (
        <>
          <div className="overlay" onClick={closeComposer} />
          <div className="composer" role="dialog" aria-label={creating ? 'New project' : 'Edit project'}>
            <header className="composer-header">
              <strong>{creating ? 'New project' : 'Edit project'}</strong>
              <button type="button" className="icon-btn" aria-label="Close" onClick={closeComposer}>
                <Icon icon={I.close} width={16} />
              </button>
            </header>
            <div className="composer-body">
              <div className="field">
                <label htmlFor="pj-name">Name</label>
                <input
                  id="pj-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void save();
                    }
                  }}
                  placeholder="e.g. Website redesign"
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Color</label>
                <div className="color-grid" role="listbox" aria-label="Project color">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch${color === c ? ' selected' : ''}`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                      aria-selected={color === c}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="pj-notes">Notes (optional)</label>
                <textarea
                  id="pj-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Who owns this? Any useful context…"
                />
              </div>
            </div>
            <footer className="composer-footer">
              <button type="button" className="btn" onClick={closeComposer}>
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
