import { BrowserWindow, clipboard, ipcMain, shell, app, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import {
  DataRoot,
  addCategory,
  appendAudit,
  deleteCategory,
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
  renameCategory,
  reorderCategories,
  setDefaultCategory,
  setProjectArchived,
  statsOf,
  todayDate,
  upsertProject,
  writeSettings,
  writeStore,
} from '../../shared/store';
import { activeProjectNames } from '../../shared/types';
import { buildEmailDraft } from '../../shared/email';
import { buildAnalyticsCsv, computeAnalytics, writeEmailArtifacts } from '../../shared/analytics';
import {
  cancelDownload,
  deleteModel,
  listLocalModels,
  pauseDownload,
  polishTexts,
  resolvePolishModelId,
  startDownload,
} from '../llm/models';
import {
  cancelEngineInstall,
  getEngineStatus,
  installEngine,
  uninstallEngine,
  clearLlamaModuleCache,
} from '../llm/engine';
import type { AppSettings, SubItem, Task, TaskPriority, TaskStatus } from '../../shared/types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function simulatePasteShortcut(): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      // SendKeys to the foreground window (Gmail in the browser)
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          'Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 1500; [System.Windows.Forms.SendKeys]::SendWait("^v")',
        ],
        { windowsHide: true, timeout: 8000 },
      );
      return true;
    }
    if (process.platform === 'darwin') {
      await execFileAsync(
        'osascript',
        ['-e', 'delay 1.5', '-e', 'tell application "System Events" to keystroke "v" using command down'],
        { timeout: 8000 },
      );
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

type Deps = {
  getRoot: () => DataRoot;
  getWindow: () => BrowserWindow | null;
  applyAutostart: (enabled: boolean) => void;
  createWindow: (mode?: string) => Promise<BrowserWindow>;
  setRemindersPaused?: (paused: boolean) => void;
  getRemindersPaused?: () => boolean;
  rebuildTray?: () => void;
};

/** Shared updater state so UI never shows "Restart & install" on errors. */
let updateReady = false;
let lastUpdateError: string | null = null;
/** Cached feed result — survives events that fired before the renderer mounted. */
let updateAvailable = false;
let lastAvailableVersion: string | null = null;
let checkInFlight: Promise<{
  ok: boolean;
  isUpdateAvailable: boolean;
  updateInfo: { version: string } | null;
  ready: boolean;
  error: string | null;
}> | null = null;

/** Reminder mode waiting for the board page to mount (hourly | eod). */
let pendingReminderMode: string | null = null;

/** Queue a reminder for the next board mount (`reminder:consume`). */
export function queueReminder(mode: string) {
  pendingReminderMode = mode;
}

/**
 * Clear any queued reminder. Call when the reminder is delivered live so a later
 * board remount cannot reopen a modal the user already dismissed.
 */
export function clearPendingReminder() {
  pendingReminderMode = null;
}

export function markUpdateReady(ready: boolean) {
  updateReady = ready;
  if (ready) lastUpdateError = null;
}

export function markUpdateAvailable(info?: { version?: string } | null) {
  updateAvailable = true;
  if (info?.version) lastAvailableVersion = String(info.version);
  lastUpdateError = null;
}

export function markUpdateNotAvailable() {
  // Never wipe a package that is already downloaded and waiting to install.
  if (updateReady) return;
  updateAvailable = false;
  lastAvailableVersion = null;
}

/**
 * Record a feed/network error without destroying a completed download.
 * (Common on office VPN / proxy flaps after the package is already local.)
 */
export function markUpdateError(message: string) {
  lastUpdateError = message;
  if (!updateReady) {
    // Leave updateAvailable / version intact so a flaky check doesn't hide a known update.
  }
}

/** Snapshot for IPC + re-broadcast after the window loads (avoids missed events). */
export function getUpdaterSnapshot() {
  return {
    ready: updateReady,
    isUpdateAvailable: updateAvailable || updateReady,
    updateInfo: lastAvailableVersion ? { version: lastAvailableVersion } : null,
    error: lastUpdateError ? friendlyUpdateError(lastUpdateError) : null,
    packaged: app.isPackaged,
    version: app.getVersion(),
    platform: process.platform,
    updaterActive: autoUpdater.isUpdaterActive(),
  };
}

/**
 * Single-flight update check — used by IPC, launch modal, and the background timer.
 * Never call `autoUpdater.checkForUpdates()` elsewhere or checks will race.
 */
export async function runUpdateCheck() {
  if (checkInFlight) return checkInFlight;
  checkInFlight = (async () => {
    try {
      if (!autoUpdater.isUpdaterActive()) {
        return {
          ok: false,
          isUpdateAvailable: updateAvailable || updateReady,
          updateInfo: lastAvailableVersion ? { version: lastAvailableVersion } : null,
          ready: updateReady,
          error:
            process.platform === 'darwin'
              ? 'Automatic update isn’t available for this Mac build yet (unsigned).'
              : 'The updater is disabled in this build.',
        };
      }
      const result = await autoUpdater.checkForUpdates();
      lastUpdateError = null;
      if (!result) {
        return {
          ok: false,
          isUpdateAvailable: updateAvailable || updateReady,
          updateInfo: lastAvailableVersion ? { version: lastAvailableVersion } : null,
          ready: updateReady,
          error: 'Updater did not run.',
        };
      }
      const remoteVersion = result.updateInfo?.version ? String(result.updateInfo.version) : null;
      const hasUpdate = Boolean(result.isUpdateAvailable);
      if (hasUpdate && remoteVersion) {
        updateAvailable = true;
        lastAvailableVersion = remoteVersion;
      } else if (!hasUpdate && !updateReady) {
        // Only clear the cache when we are truly up to date (not mid/post download).
        updateAvailable = false;
        lastAvailableVersion = null;
      }
      return {
        ok: true,
        isUpdateAvailable: hasUpdate || updateReady,
        updateInfo:
          (hasUpdate && remoteVersion) || lastAvailableVersion
            ? { version: (hasUpdate && remoteVersion) || lastAvailableVersion! }
            : null,
        ready: updateReady,
        error: null,
      };
    } catch (err) {
      const raw = (err as Error).message;
      markUpdateError(raw);
      return {
        ok: false,
        isUpdateAvailable: updateAvailable || updateReady,
        updateInfo: lastAvailableVersion ? { version: lastAvailableVersion } : null,
        ready: updateReady,
        error: friendlyUpdateError(raw),
      };
    } finally {
      checkInFlight = null;
    }
  })();
  return checkInFlight;
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

function dayPayload(
  root: DataRoot,
  date: string,
  carry?: {
    carried: number;
    from: string | null;
  },
) {
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
      defaultCategory: settings.defaultCategory,
      timezone: settings.timezone,
      emailTo: settings.emailTo,
      emailCc: settings.emailCc || '',
    },
    ...(carry ? { carry } : {}),
  };
}

export function registerIpc(deps: Deps) {
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) throw new Error('Invalid URL');
    await shell.openExternal(u);
    return { ok: true };
  });

  /** Window / Dock icon always uses the Daybook notebook mark (no theme swap). */
  ipcMain.handle('app:setThemeIcon', () => {
    try {
      const candidates = [
        path.join(__dirname, '..', 'assets', 'app-icon.png'),
        path.join(process.cwd(), 'electron', 'assets', 'app-icon.png'),
        path.join(app.getAppPath(), 'dist-electron', 'electron', 'assets', 'app-icon.png'),
        path.join(process.resourcesPath || '', 'app.asar', 'dist-electron', 'electron', 'assets', 'app-icon.png'),
        path.join(process.resourcesPath || '', 'app.asar', 'electron', 'assets', 'app-icon.png'),
        path.join(__dirname, '..', '..', 'build', 'icon.png'),
      ];

      let imgPath: string | null = null;
      for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
          imgPath = candidate;
          break;
        }
      }

      if (imgPath) {
        const img = nativeImage.createFromPath(imgPath);
        if (!img.isEmpty()) {
          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            win.setIcon(img);
          }
          if (process.platform === 'darwin' && app.dock) {
            app.dock.setIcon(img);
          }
        }
      } else {
        console.warn('[app:setThemeIcon] Could not find app-icon.png');
      }
    } catch (err) {
      console.error('Failed to set theme icon:', err);
    }
  });

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
        detailsHtml?: string;
      },
    ) => {
      const root = deps.getRoot();
      const settings = readSettings(root);
      const title = payload.title.trim();
      if (!title) throw new Error('Please enter a task title');
      const project = (payload.project || settings.defaultProject).trim();
      ensureProject(root, project);
      const time = hhmm(settings.timezone);
      const detailsHtml = typeof payload.detailsHtml === 'string' ? payload.detailsHtml : undefined;
      const task: Task = {
        id: newId(),
        project,
        category: (payload.category || settings.defaultCategory || 'Other').trim(),
        title,
        status: normalizeStatus(payload.status ?? 'wip'),
        priority: normalizePriority(payload.priority),
        dueDate: payload.dueDate || undefined,
        subItems: normalizeSubItems(payload.subItems),
        detailsHtml,
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
          detailsHtml: string;
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
      if (payload.patch.status !== undefined) {
        task.status = normalizeStatus(payload.patch.status);
        if (task.status === 'done') {
          delete task.carriedFrom;
        }
      }
      if (payload.patch.priority !== undefined) task.priority = normalizePriority(payload.patch.priority);
      if (payload.patch.dueDate !== undefined) {
        task.dueDate = payload.patch.dueDate || undefined;
      }
      if (payload.patch.subItems !== undefined) task.subItems = normalizeSubItems(payload.patch.subItems);
      if (payload.patch.detailsHtml !== undefined) task.detailsHtml = payload.patch.detailsHtml;
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
    let enhanceMode: 'none' | 'rule' | 'llm' = 'none';

    if (payload.enhance) {
      const engineOk = getEngineStatus(root).installed;
      // Polish button uses Local AI whenever engine + a GGUF are available.
      // Do not require the Settings toggle - "Use for Polish" / any installed model is enough.
      const modelId = engineOk ? resolvePolishModelId(root, settings.selectedModelId) : null;
      const useLlm = Boolean(modelId);

      type Target =
        | { kind: 'title'; taskIdx: number }
        | { kind: 'sub'; taskIdx: number; subIdx: number };
      const targets: Target[] = [];
      const inputs: string[] = [];

      store.tasks.forEach((task, taskIdx) => {
        targets.push({ kind: 'title', taskIdx });
        inputs.push(task.title);
        task.subItems.forEach((sub, subIdx) => {
          targets.push({ kind: 'sub', taskIdx, subIdx });
          inputs.push(sub.text);
        });
      });

      const { texts: polished, mode } = await polishTexts(root, useLlm ? modelId : null, inputs);
      targets.forEach((t, i) => {
        if (t.kind === 'title') {
          store.tasks[t.taskIdx].titleEnhanced = polished[i];
        } else {
          store.tasks[t.taskIdx].subItems[t.subIdx].enhanced = polished[i];
        }
      });
      writeStore(root, payload.date, store);
      store = readStore(root, payload.date);
      enhanceMode = useLlm && mode === 'llm' ? 'llm' : 'rule';

      // Persist selection so next polish / Settings stay in sync
      if (useLlm && modelId && (settings.selectedModelId !== modelId || !settings.aiEnhanceEnabled)) {
        writeSettings(root, { ...settings, selectedModelId: modelId, aiEnhanceEnabled: true });
      }
    }

    const draft = buildEmailDraft(
      payload.date,
      displayDate(payload.date),
      store.tasks,
      settings,
    );
    writeEmailArtifacts(root, payload.date, draft);
    return { ...draft, enhanceMode };
  });

  ipcMain.handle('email:markSent', (_e, date: string) => {
    const root = deps.getRoot();
    const settings = readSettings(root);
    const dates = new Set(settings.emailSentDates || []);
    dates.add(date);
    writeSettings(root, { ...settings, emailSentDates: [...dates].sort() });
    return readSettings(root);
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
    // Subject + To only - never put body in the Gmail URL
    let gmailUrl = draft.gmailUrl;
    try {
      const u = new URL(draft.gmailUrl);
      u.searchParams.delete('body');
      gmailUrl = u.toString();
    } catch {
      /* keep original */
    }
    await shell.openExternal(gmailUrl);
    const pasted = await simulatePasteShortcut();
    return {
      ok: true,
      pasted,
      pasteHint:
        process.platform === 'darwin'
          ? 'Copied. In Gmail, press ⌘V once to paste your update.'
          : 'Copied. In Gmail, press Ctrl+V once to paste your update.',
    };
  });

  ipcMain.handle('categories:add', (_e, name: string) => {
    const settings = addCategory(deps.getRoot(), name);
    return { categories: settings.categories, defaultCategory: settings.defaultCategory };
  });
  ipcMain.handle('categories:rename', (_e, payload: { from: string; to: string }) => {
    const settings = renameCategory(deps.getRoot(), payload.from, payload.to);
    return { categories: settings.categories, defaultCategory: settings.defaultCategory };
  });
  ipcMain.handle('categories:reorder', (_e, order: string[]) => {
    const settings = reorderCategories(deps.getRoot(), order);
    return { categories: settings.categories, defaultCategory: settings.defaultCategory };
  });
  ipcMain.handle('categories:delete', (_e, name: string) => {
    const settings = deleteCategory(deps.getRoot(), name);
    return { categories: settings.categories, defaultCategory: settings.defaultCategory };
  });
  ipcMain.handle('settings:setDefaultCategory', (_e, name: string) => {
    const settings = setDefaultCategory(deps.getRoot(), name);
    return { categories: settings.categories, defaultCategory: settings.defaultCategory };
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

  ipcMain.handle('engine:status', () => getEngineStatus(deps.getRoot()));
  ipcMain.handle('engine:install', async () => installEngine(deps.getRoot()));
  ipcMain.handle('engine:cancel', () => cancelEngineInstall());
  ipcMain.handle('engine:uninstall', () => {
    clearLlamaModuleCache();
    return { ok: uninstallEngine(deps.getRoot()) };
  });

  ipcMain.handle('reminder:consume', () => {
    const mode = pendingReminderMode;
    pendingReminderMode = null;
    return { mode };
  });

  ipcMain.handle('analytics:get', (_e, range?: string) => {
    const allowed = new Set(['week', '7', '30', '90']);
    const r = allowed.has(String(range)) ? (range as 'week' | '7' | '30' | '90') : '30';
    return computeAnalytics(deps.getRoot(), r);
  });
  ipcMain.handle('analytics:csv', (_e, range?: string) => {
    const allowed = new Set(['week', '7', '30', '90']);
    const r = allowed.has(String(range)) ? (range as 'week' | '7' | '30' | '90') : '30';
    return buildAnalyticsCsv(deps.getRoot(), r);
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

  ipcMain.handle('updater:status', () => getUpdaterSnapshot());

  ipcMain.handle('updater:check', async () => {
    const checked = await runUpdateCheck();
    const remoteVersion = checked.updateInfo?.version || null;
    const hasUpdate = checked.isUpdateAvailable;
    return {
      ...checked,
      packaged: app.isPackaged,
      version: app.getVersion(),
      message: !checked.ok
        ? checked.error || 'Update check failed.'
        : hasUpdate
          ? updateReady
            ? `Version ${remoteVersion} is ready to install.`
            : `Version ${remoteVersion} found - downloading…`
          : `You’re on the latest version (${app.getVersion()}${
              remoteVersion ? `; feed ${remoteVersion}` : ''
            }).`,
    };
  });

  ipcMain.handle('updater:install', () => {
    if (!app.isPackaged) {
      return {
        ok: false,
        error: 'Install from a packaged build before applying updates.',
      };
    }
    if (process.platform === 'darwin') {
      return {
        ok: false,
        error:
          'Automatic update isn’t available for this Mac build yet (unsigned). Use Download DMG and the xattr command on the Updates page.',
      };
    }
    if (!updateReady) {
      return { ok: false, error: 'No update is ready to install yet.' };
    }
    // isSilent=false, isForceRunAfter=true - relaunch after install (Cursor-like)
    try {
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: `${(err as Error).message}. Download the Setup from GitHub Releases if restart fails.`,
      };
    }
  });

  ipcMain.handle('updater:getMacAssist', (_e, version?: string) => {
    const verNum = (typeof version === 'string' && version.trim() ? version.trim() : app.getVersion()).replace(
      /^v/,
      '',
    );
    const tag = `v${verNum}`;
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    return {
      unsigned: process.platform === 'darwin',
      platform: process.platform,
      xattrCommand: 'xattr -cr /Applications/Daybook.app',
      dmgUrl: `https://github.com/GautamPatoliya/daybook-desktop/releases/download/${tag}/Daybook-${verNum}-${arch}.dmg`,
      releasesUrl: 'https://github.com/GautamPatoliya/daybook-desktop/releases',
      setupUrl: `https://github.com/GautamPatoliya/daybook-desktop/releases/download/${tag}/Daybook-Setup-${verNum}.exe`,
    };
  });

  ipcMain.handle('updater:checkOnLaunch', async () => {
    const settings = readSettings(deps.getRoot());
    const base = {
      deferred: !settings.onboardingComplete,
      packaged: app.isPackaged,
      platform: process.platform,
      version: app.getVersion(),
      ready: updateReady,
      error: lastUpdateError ? friendlyUpdateError(lastUpdateError) : null,
    };
    if (!settings.onboardingComplete || !app.isPackaged) {
      return { ...base, ok: true, isUpdateAvailable: false, updateInfo: null };
    }

    // Prefer cached feed/event state so the launch modal works even if the
    // background check already ran (or fired before the renderer mounted).
    const snap = getUpdaterSnapshot();
    if (snap.ready || (snap.isUpdateAvailable && snap.updateInfo?.version)) {
      return {
        ...base,
        ok: true,
        isUpdateAvailable: snap.isUpdateAvailable,
        updateInfo: snap.updateInfo,
        ready: snap.ready,
        error: snap.error,
      };
    }

    const checked = await runUpdateCheck();
    return {
      ...base,
      ok: checked.ok,
      isUpdateAvailable: checked.isUpdateAvailable,
      updateInfo: checked.updateInfo,
      ready: checked.ready,
      error: checked.error,
    };
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

  ipcMain.handle('reminders:setPaused', (_e, paused: boolean) => {
    deps.setRemindersPaused?.(Boolean(paused));
    return { ok: true, paused: Boolean(paused) };
  });
  ipcMain.handle('reminders:getPaused', () => ({ paused: Boolean(deps.getRemindersPaused?.()) }));
}

function appPathFallback() {
  try {
    const { app } = require('electron') as typeof import('electron');
    return app.getAppPath();
  } catch {
    return process.cwd();
  }
}
