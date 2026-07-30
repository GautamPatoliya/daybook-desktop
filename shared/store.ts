import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AppSettings, ProjectMeta, SubItem, Task, TaskPriority, TaskStatus, TaskStore } from './types';
import { DEFAULT_SETTINGS, PROJECT_COLORS, activeProjectNames, normalizeProjects } from './types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class DataRoot {
  constructor(public root: string) {}

  get settingsPath() {
    return path.join(this.root, 'settings.json');
  }
  get dataDir() {
    return path.join(this.root, 'data');
  }
  get modelsDir() {
    return path.join(this.root, 'models');
  }

  ensureDirs() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.modelsDir, { recursive: true });
  }
}

export function assertDate(date: string): string {
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date}`);
  return date;
}

export function newId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function readSettings(root: DataRoot): AppSettings {
  root.ensureDirs();
  if (!fs.existsSync(root.settingsPath)) {
    writeSettings(root, DEFAULT_SETTINGS);
    return structuredClone(DEFAULT_SETTINGS);
  }
  const raw = JSON.parse(fs.readFileSync(root.settingsPath, 'utf8')) as Partial<AppSettings> & {
    projects?: unknown;
  };
  const projects = normalizeProjects(raw.projects);
  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    projects,
    defaultProject:
      raw.defaultProject && projects.some((p) => p.name === raw.defaultProject && !p.archived)
        ? raw.defaultProject
        : activeProjectNames(projects)[0] || 'General',
  };
  return merged;
}

export function writeSettings(root: DataRoot, settings: AppSettings): void {
  root.ensureDirs();
  const next = { ...settings, projects: normalizeProjects(settings.projects) };
  fs.writeFileSync(root.settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

export function ensureProject(root: DataRoot, name: string): ProjectMeta[] {
  const project = name.trim();
  const settings = readSettings(root);
  if (!project || project.toLowerCase() === 'master') return settings.projects;
  const idx = settings.projects.findIndex((p) => p.name.toLowerCase() === project.toLowerCase());
  if (idx >= 0) {
    if (settings.projects[idx].archived) {
      settings.projects[idx] = { ...settings.projects[idx], archived: false };
      writeSettings(root, settings);
    }
    return settings.projects;
  }
  settings.projects = [
    ...settings.projects,
    {
      name: project,
      color: PROJECT_COLORS[settings.projects.length % PROJECT_COLORS.length],
      archived: false,
    },
  ];
  writeSettings(root, settings);
  return settings.projects;
}

export function upsertProject(
  root: DataRoot,
  payload: { name: string; color?: string; notes?: string; renameFrom?: string },
): ProjectMeta[] {
  const settings = readSettings(root);
  const name = payload.name.trim();
  if (!name) throw new Error('Project name is required');
  if (payload.renameFrom) {
    const from = payload.renameFrom.trim();
    const idx = settings.projects.findIndex((p) => p.name === from);
    if (idx < 0) throw new Error('Project not found');
    const clash = settings.projects.some(
      (p, i) => i !== idx && p.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) throw new Error('A project with that name already exists');
    settings.projects[idx] = {
      ...settings.projects[idx],
      name,
      color: payload.color || settings.projects[idx].color,
      notes: payload.notes ?? settings.projects[idx].notes,
    };
    if (settings.defaultProject === from) settings.defaultProject = name;
    writeSettings(root, settings);
    return settings.projects;
  }
  ensureProject(root, name);
  const next = readSettings(root);
  const idx = next.projects.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
  if (idx >= 0) {
    next.projects[idx] = {
      ...next.projects[idx],
      color: payload.color || next.projects[idx].color,
      notes: payload.notes ?? next.projects[idx].notes,
      archived: false,
    };
    writeSettings(root, next);
  }
  return readSettings(root).projects;
}

export function setProjectArchived(root: DataRoot, name: string, archived: boolean): ProjectMeta[] {
  const settings = readSettings(root);
  const idx = settings.projects.findIndex((p) => p.name === name);
  if (idx < 0) throw new Error('Project not found');
  const active = settings.projects.filter((p) => !p.archived && p.name !== name);
  if (archived && active.length === 0) throw new Error('Keep at least one active project');
  settings.projects[idx] = { ...settings.projects[idx], archived };
  if (archived && settings.defaultProject === name) {
    settings.defaultProject = active[0]?.name || settings.projects.find((p) => !p.archived)?.name || name;
  }
  writeSettings(root, settings);
  return settings.projects;
}

export function deleteProject(root: DataRoot, name: string): ProjectMeta[] {
  const settings = readSettings(root);
  const remaining = settings.projects.filter((p) => p.name !== name);
  if (!remaining.some((p) => !p.archived)) throw new Error('Keep at least one active project');
  settings.projects = remaining;
  if (settings.defaultProject === name) {
    settings.defaultProject = remaining.find((p) => !p.archived)?.name || remaining[0].name;
  }
  writeSettings(root, settings);
  return settings.projects;
}

export function normalizePriority(priority: unknown): TaskPriority {
  if (priority === 'high' || priority === 'low') return priority;
  return 'medium';
}

export function nowInTz(timezone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`);
}

export function todayDate(timezone: string): string {
  const n = nowInTz(timezone);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export function displayDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(dt);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}, ${weekday}`;
}

export function hhmm(timezone: string): string {
  const n = nowInTz(timezone);
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

export function normalizeStatus(status: unknown): TaskStatus {
  if (status === 'done' || status === 'wip') return status;
  return 'none';
}

export function dayDir(root: DataRoot, date: string): string {
  return path.join(root.dataDir, assertDate(date));
}

export function readStore(root: DataRoot, date: string): TaskStore {
  const file = path.join(dayDir(root, date), 'tasks.json');
  if (!fs.existsSync(file)) return { version: 2, tasks: [] };
  try {
    let raw = fs.readFileSync(file, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const store = JSON.parse(raw) as TaskStore;
    store.tasks = Array.isArray(store.tasks)
      ? store.tasks.filter(Boolean).map((t) => ({
          ...t,
          status: normalizeStatus(t.status),
          priority: normalizePriority((t as Task).priority),
          subItems: normalizeSubItems(t.subItems),
        }))
      : [];
    return store;
  } catch {
    return { version: 2, tasks: [] };
  }
}

export function writeStore(root: DataRoot, date: string, store: TaskStore): void {
  const dir = dayDir(root, date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tasks.json'), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export function statsOf(tasks: Task[]) {
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    wip: tasks.filter((t) => t.status === 'wip').length,
    none: tasks.filter((t) => t.status === 'none').length,
  };
}

export function previousBusinessDate(date: string, workingDays: number[]): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 14; i++) {
    dt.setUTCDate(dt.getUTCDate() - 1);
    const dow = dt.getUTCDay();
    if (workingDays.includes(dow)) {
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    }
  }
  dt.setUTCDate(dt.getUTCDate());
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function listExistingDates(root: DataRoot): string[] {
  if (!fs.existsSync(root.dataDir)) return [];
  return fs
    .readdirSync(root.dataDir)
    .filter((n) => DATE_RE.test(n) && fs.existsSync(path.join(root.dataDir, n, 'tasks.json')))
    .sort();
}

export function initDayWithCarry(root: DataRoot, date: string, settings: AppSettings) {
  assertDate(date);
  const store = readStore(root, date);
  const alreadyCarried = Boolean(store.carriedAt);
  const hasTasks = store.tasks.length > 0;
  if (alreadyCarried || hasTasks) {
    return { carried: 0, from: alreadyCarried ? previousBusinessDate(date, settings.workingDays) : null };
  }

  let from = previousBusinessDate(date, settings.workingDays);
  const existing = listExistingDates(root).filter((d) => d < date);
  let sourceTasks: Task[] = [];
  for (let i = existing.length - 1; i >= 0; i--) {
    const prev = readStore(root, existing[i]);
    const open = prev.tasks.filter((t) => t.status === 'wip' || t.status === 'none');
    if (open.length) {
      from = existing[i];
      sourceTasks = open;
      break;
    }
  }
  if (!sourceTasks.length) {
    store.carriedAt = date;
    writeStore(root, date, store);
    return { carried: 0, from: null };
  }

  const carried: Task[] = sourceTasks.map((t) => ({
    ...t,
    id: newId(),
    status: t.status === 'done' ? 'wip' : normalizeStatus(t.status),
    priority: normalizePriority(t.priority),
    createdAt: hhmm(settings.timezone),
    updatedAt: hhmm(settings.timezone),
    carriedFrom: from,
  }));
  store.tasks = carried;
  store.carriedAt = date;
  writeStore(root, date, store);
  return { carried: carried.length, from };
}

export function appendAudit(root: DataRoot, date: string, entry: Record<string, unknown>) {
  const dir = dayDir(root, date);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'entries.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
}

export function normalizeSubItems(items: Array<string | SubItem> | undefined): SubItem[] {
  return (items || [])
    .map((s) => (typeof s === 'string' ? { text: s.trim() } : { text: (s.text || '').trim(), enhanced: s.enhanced }))
    .filter((s) => s.text);
}
