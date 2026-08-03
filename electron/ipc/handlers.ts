import { BrowserWindow, clipboard, ipcMain, shell, app } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import {
  DataRoot,
  appendAudit,
  deleteProject,
  displayDate,
  ensureProject,
  hhmm,
  initDayWithCarry,
  listExistingDates,
  newId,
  normalizePriority,
  normalizeStatus,
  normalizeSubItems,
  readSettings,
  readStore,
  setProjectArchived,
  statsOf,
  todayDate,
  upsertProject,
  writeSettings,
  writeStore,
} from '../../shared/store';
import { activeProjectNames } from '../../shared/types';
import { buildEmailDraft } from '../../shared/email';
import { analyticsToCsv, computeAnalytics, writeEmailArtifacts } from '../../shared/analytics';
import {
  cancelDownload,
  deleteModel,
  listLocalModels,
  pauseDownload,
  polishText,
  startDownload,
} from '../llm/models';
import type { AppSettings, SubItem, Task, TaskPriority, TaskStatus } from '../../shared/types';

type Deps = {
  getRoot: () => DataRoot;
  getWindow: () => BrowserWindow | null;
  applyAutostart: (enabled: boolean) => void;
  createWindow: (mode?: string) => Promise<BrowserWindow>;
};

/** Shared updater state so UI never shows "Restart & install" on errors. */
let updateReady = false;
let lastUpdateError: string | null = null;

/** Reminder mode waiting for the board page to mount (hourly | eod). */
let pendingReminderMode: string | null = null;

export function queueReminder(mode: string) {
  pendingReminderMode = mode;
}

export function markUpdateReady(ready: boolean) {
  updateReady = ready;
  if (ready) lastUpdateError = null;
}

export function markUpdateError(message: string) {
  updateReady = false;
  lastUpdateError = message;
}

function friendlyUpdateError(raw: string): string {
  const msg = raw || 'Something went wrong while checking for updates.';
  if (/YOUR_GITHUB_USER/i.test(msg) || /404/.test(msg)) {
    return 'Updates are not configured for this build yet. Ask your IT admin to set the GitHub release feed, or install a newer installer when one is provided.';
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::/i.test(msg)) {
    return 'Could not reach the update server. Check your internet connection and try again.';
  }
  if (msg.length > 180) return `${msg.slice(0, 160)}…`;
  return msg;
}

function dayPayload(root: DataRoot, date: string, carry?: { carried: number; from: string | null }) {
  const settings = readSettings(root);
  const store = readStore(root, date);
  return {
    date,
    displayDate: displayDate(date),
    today: todayDate(settings.timezone),
    tasks: store.tasks,
    stats: statsOf(store.tasks),
    carriedAt: store.carriedAt || null,
    config: {
      appName: settings.appName,
      authorName: settings.authorName,
      projects: activeProjectNames(settings.projects),
      projectMeta: settings.projects.filter((p) => !p.archived),
      defaultProject: settings.defaultProject,
      categories: settings.categories,
      timezone: settings.timezone,
      emailTo: settings.emailTo,
    },
    ...(carry ? { carry } : {}),
  };
}

export function registerIpc(deps: Deps) {
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('settings:get', () => readSettings(deps.getRoot()));
  ipcMain.handle('settings:save', (_e, partial: Partial<AppSettings>) => {
    const root = deps.getRoot();
    const next = { ...readSettings(root), ...partial };
    writeSettings(root, next);
    if (typeof partial.autostart === 'boolean') deps.applyAutostart(partial.autostart);
    return next;
  });

  ipcMain.handle('projects:add', (_e, name: string) => {
    const root = deps.getRoot();
    const projects = ensureProject(root, name);
    return { projects, added: name.trim() };
  });

  ipcMain.handle(
    'projects:upsert',
    (
      _e,
      payload: { name: string; color?: string; notes?: string; renameFrom?: string },
    ) => {
      const root = deps.getRoot();
      const projects = upsertProject(root, payload);
      return { projects };
    },
  );

  ipcMain.handle('projects:archive', (_e, payload: { name: string; archived: boolean }) => {
    const root = deps.getRoot();
    const projects = setProjectArchived(root, payload.name, payload.archived);
    return { projects };
  });

  ipcMain.handle('projects:delete', (_e, name: string) => {
    const root = deps.getRoot();
    const projects = deleteProject(root, name);
    return { projects };
  });

  ipcMain.handle('day:get', (_e, date: string) => dayPayload(deps.getRoot(), date));
  ipcMain.handle('day:init', (_e, date: string) => {
    const root = deps.getRoot();
    const settings = readSettings(root);
    const carry = initDayWithCarry(root, date, settings);
    return dayPayload(root, date, carry);
  });

  ipcMain.handle(
    'task:create',
    (
      _e,
      payload: {
        date: string;
        title: string;
        project?: string;
        category?: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        dueDate?: string;
        subItems?: Array<string | SubItem>;
      },
    ) => {
      const root = deps.getRoot();
      const settings = readSettings(root);
      const title = payload.title.trim();
      if (!title) throw new Error('Please enter a task title');
      const project = (payload.project || settings.defaultProject).trim();
      ensureProject(root, project);
      const time = hhmm(settings.timezone);
      const task: Task = {
        id: newId(),
        project,
        category: (payload.category || 'Other').trim(),
        title,
        status: normalizeStatus(payload.status ?? 'wip'),
        priority: normalizePriority(payload.priority),
        dueDate: payload.dueDate || undefined,
        subItems: normalizeSubItems(payload.subItems),
        createdAt: time,
        updatedAt: time,
      };
      const store = readStore(root, payload.date);
      store.tasks = [...store.tasks, task];
      writeStore(root, payload.date, store);
      appendAudit(root, payload.date, {
        id: newId(),
        taskId: task.id,
        time,
        timestamp: new Date().toISOString(),
        project,
        category: task.category,
        status: task.status,
        raw: title,
        source: 'board',
      });
      return { task, ...dayPayload(root, payload.date) };
    },
  );

  ipcMain.handle(
    'task:update',
    (
      _e,
      payload: {
        date: string;
        id: string;
        patch: Partial<{
          title: string;
          project: string;
          category: string;
          status: TaskStatus;
          priority: TaskPriority;
          dueDate: string | null;
          subItems: SubItem[];
        }>;
      },
    ) => {
      const root = deps.getRoot();
      const settings = readSettings(root);
      const store = readStore(root, payload.date);
      const idx = store.tasks.findIndex((t) => t.id === payload.id);
      if (idx < 0) throw new Error('Task not found');
      const task = { ...store.tasks[idx] };
      if (payload.patch.project !== undefined) {
        task.project = payload.patch.project.trim();
        ensureProject(root, task.project);
      }
      if (payload.patch.category !== undefined) task.category = payload.patch.category.trim();
      if (payload.patch.title !== undefined) {
        const t = payload.patch.title.trim();
        if (!t) throw new Error('Please enter a task title');
        task.title = t;
      }
      if (payload.patch.status !== undefined) task.status = normalizeStatus(payload.patch.status);
      if (payload.patch.priority !== undefined) task.priority = normalizePriority(payload.patch.priority);
      if (payload.patch.dueDate !== undefined) {
        task.dueDate = payload.patch.dueDate || undefined;
      }
      if (payload.patch.subItems !== undefined) task.subItems = normalizeSubItems(payload.patch.subItems);
      task.updatedAt = hhmm(settings.timezone);
      store.tasks[idx] = task;
      writeStore(root, payload.date, store);
      return { task, ...dayPayload(root, payload.date) };
    },
  );

  ipcMain.handle('task:delete', (_e, payload: { date: string; id: string }) => {
    const root = deps.getRoot();
    const store = readStore(root, payload.date);
    store.tasks = store.tasks.filter((t) => t.id !== payload.id);
    writeStore(root, payload.date, store);
    return dayPayload(root, payload.date);
  });

  ipcMain.handle('email:draft', async (_e, payload: { date: string; enhance?: boolean }) => {
    const root = deps.getRoot();
    const settings = readSettings(root);
    let store = readStore(root, payload.date);
    if (payload.enhance && settings.aiEnhanceEnabled) {
      for (const task of store.tasks) {
        if (!task.subItems.length) {
          task.titleEnhanced = await polishText(root, settings.selectedModelId, task.title);
        } else {
          for (const sub of task.subItems) {
            sub.enhanced = await polishText(root, settings.selectedModelId, sub.text);
          }
        }
      }
      writeStore(root, payload.date, store);
      store = readStore(root, payload.date);
    }
    const draft = buildEmailDraft(payload.date, displayDate(payload.date), store.tasks, settings);
    writeEmailArtifacts(root, payload.date, draft);
    return draft;
  });

  ipcMain.handle('email:copy', (_e, draft: { htmlBody: string; body: string; subject: string }) => {
    clipboard.write({
      html: `<!DOCTYPE html><html><body><!--StartFragment-->${draft.htmlBody}<!--EndFragment--></body></html>`,
      text: draft.body,
    });
    return { ok: true, subject: draft.subject };
  });

  ipcMain.handle('email:open', async (_e, draft: { gmailUrl: string; htmlBody: string; body: string }) => {
    clipboard.write({
      html: `<!DOCTYPE html><html><body><!--StartFragment-->${draft.htmlBody}<!--EndFragment--></body></html>`,
      text: draft.body,
    });
    await shell.openExternal(draft.gmailUrl);
    return { ok: true };
  });

  ipcMain.handle('models:list', () => listLocalModels(deps.getRoot()));
  ipcMain.handle('models:delete', (_e, id: string) => deleteModel(deps.getRoot(), id));
  ipcMain.handle('models:cancel', (_e, id: string) => {
    cancelDownload(deps.getRoot(), id);
    return { ok: true };
  });
  ipcMain.handle('models:pause', (_e, id: string) => {
    pauseDownload(deps.getRoot(), id);
    return { ok: true };
  });
  ipcMain.handle('models:download', (_e, id: string) => {
    const result = startDownload(deps.getRoot(), id);
    if (!result.ok) throw new Error(result.error);
    return { started: true };
  });

  ipcMain.handle('reminder:consume', () => {
    const mode = pendingReminderMode;
    pendingReminderMode = null;
    return { mode };
  });

  ipcMain.handle('analytics:get', () => computeAnalytics(deps.getRoot()));
  ipcMain.handle('analytics:csv', () => {
    const summary = computeAnalytics(deps.getRoot());
    return analyticsToCsv(summary);
  });

  ipcMain.handle('dates:list', () => listExistingDates(deps.getRoot()));

  ipcMain.handle('changelog:get', () => {
    const candidates = [
      path.join(process.resourcesPath || '', 'CHANGELOG.md'),
      path.join(__dirname, '..', '..', 'CHANGELOG.md'),
      path.join(appPathFallback(), 'CHANGELOG.md'),
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    }
    return '# What\'s new\n\n- Offline board for daily work\n- Daily email draft\n- Local analytics\n';
  });

  ipcMain.handle('updater:status', () => ({
    ready: updateReady,
    error: lastUpdateError ? friendlyUpdateError(lastUpdateError) : null,
    packaged: app.isPackaged,
    version: app.getVersion(),
    updaterActive: autoUpdater.isUpdaterActive(),
  }));

  ipcMain.handle('updater:check', async () => {
    try {
      if (!autoUpdater.isUpdaterActive()) {
        const hint = app.isPackaged
          ? 'The updater is disabled in this build.'
          : 'Updates only run in a packaged install (or with forceDevUpdateConfig). Use the Setup/.dmg build to test end-to-end.';
        return {
          ok: false,
          error: hint,
          ready: false,
          packaged: app.isPackaged,
          version: app.getVersion(),
        };
      }

      const result = await autoUpdater.checkForUpdates();
      lastUpdateError = null;

      // checkForUpdates() returns null when the updater is inactive.
      // When active, always prefer isUpdateAvailable — updateInfo is present even when up to date.
      if (!result) {
        return {
          ok: false,
          error:
            'Updater did not run. Install Daybook from the Setup/.dmg package to check for updates.',
          ready: false,
          packaged: app.isPackaged,
          version: app.getVersion(),
        };
      }

      const remoteVersion = result.updateInfo?.version || null;
      const hasUpdate = Boolean(result.isUpdateAvailable);
      const downloading = hasUpdate && Boolean(result.downloadPromise);

      return {
        ok: true,
        updateInfo: remoteVersion ? { version: remoteVersion } : null,
        isUpdateAvailable: hasUpdate,
        ready: updateReady,
        packaged: app.isPackaged,
        version: app.getVersion(),
        message: hasUpdate
          ? updateReady
            ? `Version ${remoteVersion} is ready to install.`
            : downloading
              ? `Version ${remoteVersion} found — downloading…`
              : `Version ${remoteVersion} is available.`
          : `You’re on the latest version (${app.getVersion()}${
              remoteVersion ? `; feed ${remoteVersion}` : ''
            }).`,
      };
    } catch (err) {
      const raw = (err as Error).message;
      markUpdateError(raw);
      return {
        ok: false,
        error: friendlyUpdateError(raw),
        ready: false,
        packaged: app.isPackaged,
        version: app.getVersion(),
      };
    }
  });

  ipcMain.handle('updater:install', () => {
    if (!app.isPackaged) {
      return {
        ok: false,
        error: 'Install from a packaged build before applying updates.',
      };
    }
    if (!updateReady) {
      return { ok: false, error: 'No update is ready to install yet.' };
    }
    autoUpdater.quitAndInstall();
    return { ok: true };
  });

  ipcMain.handle('shell:openPath', async (_e, target: string) => shell.openPath(target));

  ipcMain.handle('data:wipe', () => {
    const root = deps.getRoot();
    const dataDir = root.dataDir;
    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
    root.ensureDirs();
    return { ok: true };
  });

  ipcMain.handle('data:openFolder', async () => {
    const root = deps.getRoot();
    return shell.openPath(root.root);
  });
}

function appPathFallback() {
  try {
    const { app } = require('electron') as typeof import('electron');
    return app.getAppPath();
  } catch {
    return process.cwd();
  }
}
