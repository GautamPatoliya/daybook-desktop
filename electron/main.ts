import {
  app,
  BrowserWindow,
  Notification,
  Tray,
  Menu,
  dialog,
  nativeImage,
  powerMonitor,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import AutoLaunch from 'auto-launch';
import { autoUpdater } from 'electron-updater';
import { DataRoot, readSettings, readStore, todayDate, statsOf } from '../shared/store';
import { shouldFireReminder } from './scheduler/reminders';
import {
  clearPendingReminder,
  markUpdateError,
  markUpdateReady,
  queueReminder,
  registerIpc,
} from './ipc/handlers';
import { adoptExistingEngine } from './llm/engine';
import {
  hasRendererExport,
  rendererOutDir,
  startStaticServer,
  WTT_UI_PORT,
} from './static-server';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let dataRoot: DataRoot;
let lastHourlyKey: string | null = null;
let lastEodKey: string | null = null;
let reminderTimer: NodeJS.Timeout | null = null;
let powerMonitorBound = false;
let staticBaseUrl: string | null = null;
let closeStaticServer: (() => void) | null = null;
let isQuitting = false;
/** Session-only pause reminders (cleared on quit). */
let remindersPaused = false;

const isDev = process.env.ELECTRON_DEV === '1';
const APP_USER_MODEL_ID = 'com.bcreative.worktasktracker';

/** Windows toast header + icon - must run before app.ready. */
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}
app.setName('Daybook');

/** Only one Daybook process - prevents duplicate windows + tray icons on Windows. */
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _argv) => {
    void focusMainWindow();
  });
}

// Keep Chromium defaults for background throttling (better for low-end PCs).
// Avoid aggressive disableHardwareAcceleration - it helps some GPUs and hurts others.

function getDataRoot(): DataRoot {
  const root = new DataRoot(path.join(app.getPath('userData')));
  root.ensureDirs();
  return root;
}

function preloadPath() {
  return path.join(__dirname, 'preload.js');
}

function rendererUrl(route = '/') {
  if (isDev) return `http://127.0.0.1:${WTT_UI_PORT}${route}`;
  if (!staticBaseUrl) throw new Error('Static server not started');
  return `${staticBaseUrl}${route.startsWith('/') ? route : `/${route}`}`;
}

function resolveIconPath(): string | null {
  const candidates = [
    path.join(__dirname, 'assets', 'app-icon.png'),
    path.join(__dirname, 'assets', 'tray-32.png'),
    path.join(process.cwd(), 'electron', 'assets', 'app-icon.png'),
    path.join(process.cwd(), 'build', 'icon.png'),
    path.join(app.getAppPath(), 'dist-electron', 'electron', 'assets', 'app-icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.png'),
    path.join(__dirname, '..', '..', 'build', 'icon.png'),
    path.join(process.resourcesPath || '', 'build', 'icon.png'),
  ];
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function loadAppIcon(): Electron.NativeImage | undefined {
  const candidates = [
    path.join(__dirname, 'assets', 'app-icon.png'),
    path.join(process.cwd(), 'electron', 'assets', 'app-icon.png'),
    path.join(app.getAppPath(), 'dist-electron', 'electron', 'assets', 'app-icon.png'),
    resolveIconPath(),
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const img = nativeImage.createFromPath(candidate);
      if (!img.isEmpty()) return img;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

/** Tray icons from `npm run icons:generate` (tray-16 / tray-32). */
function loadTrayIcon(): Electron.NativeImage {
  const trayFile = process.platform === 'win32' ? 'tray-16.png' : 'tray-32.png';
  const candidates = [
    path.join(__dirname, 'assets', trayFile),
    path.join(__dirname, 'assets', 'tray-16.png'),
    path.join(__dirname, 'assets', 'tray-32.png'),
    path.join(process.cwd(), 'electron', 'assets', trayFile),
    path.join(app.getAppPath(), 'dist-electron', 'electron', 'assets', trayFile),
  ];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const img = nativeImage.createFromPath(candidate);
      if (!img.isEmpty()) return img;
    } catch {
      /* ignore */
    }
  }

  const iconPath = resolveIconPath();
  if (iconPath) {
    let img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      const size = process.platform === 'win32' ? 16 : 22;
      img = img.resize({ width: size, height: size, quality: 'best' });
      if (!img.isEmpty()) return img;
    }
  }

  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAANUlEQVQ4T2NkYGD4z0ABYBzVMKoGAmA0jKoBA0bDYDQMRsNgNAxGw2A0DEbDYDQMRsNgNAxGwwAA0gQEAf2v+6YAAAAASUVORK5CYII=',
  );
}

/**
 * Push a reminder to the live board renderer. Clears any queued pending mode so
 * a later remount cannot replay a reminder the user already saw/dismissed.
 */
function deliverReminder(mode: string) {
  clearPendingReminder();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('reminder:open', { mode });
  }
}

function isBoardUrl(url: string) {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    return p === '/' || p === '';
  } catch {
    return false;
  }
}

/**
 * Reminder delivery protocol (exactly once):
 * - Board already mounted → live `reminder:open` only (no pending queue).
 * - Navigating / cold start → queue for `reminder:consume` on board mount only.
 * Never queue + deliver together - that left pending set after dismiss and
 * reopened the composer when returning to the board.
 */
async function routeReminder(mode: string): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!isBoardUrl(mainWindow.webContents.getURL())) {
    queueReminder(mode);
    await new Promise<void>((resolve) => {
      mainWindow!.webContents.once('did-finish-load', () => resolve());
      void mainWindow!.loadURL(rendererUrl('/'));
    });
    return;
  }
  deliverReminder(mode);
}

async function focusMainWindow(mode?: string): Promise<BrowserWindow> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return createWindow(mode);
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (mode === 'hourly' || mode === 'eod') {
    await routeReminder(mode);
  }
  return mainWindow;
}

async function createWindow(mode?: string): Promise<BrowserWindow> {
  const isReminder = mode === 'hourly' || mode === 'eod';

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (mode === 'onboarding') {
      await mainWindow.loadURL(rendererUrl('/onboarding/'));
      return mainWindow;
    }
    if (isReminder && mode) {
      await routeReminder(mode);
    }
    return mainWindow;
  }

  if (isReminder && mode) queueReminder(mode);

  const appIcon = loadAppIcon();
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    show: false,
    backgroundColor: '#07080c',
    title: 'Daybook',
    ...(appIcon ? { icon: appIcon } : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: true,
    },
  });

  // Windows taskbar / Alt-Tab often keep a cached shell icon; re-apply after create.
  if (appIcon && !appIcon.isEmpty()) {
    try {
      mainWindow.setIcon(appIcon);
    } catch {
      /* ignore */
    }
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('Renderer failed to load', { code, desc, url });
  });

  mainWindow.once('ready-to-show', () => {
    if (appIcon && !appIcon.isEmpty()) {
      try {
        mainWindow?.setIcon(appIcon);
      } catch {
        /* ignore */
      }
    }
    mainWindow?.show();
  });

  const startRoute = mode === 'onboarding' ? '/onboarding/' : '/';
  await mainWindow.loadURL(rendererUrl(startRoute));

  mainWindow.on('close', (e) => {
    // Keep running in tray for reminders (unless quitting)
    if (!isQuitting && process.platform === 'win32') {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function resolveWorkingOnTitle(): string {
  try {
    const settings = readSettings(dataRoot);
    const date = todayDate(settings.timezone);
    const store = readStore(dataRoot, date);
    const wip = store.tasks
      .filter((t) => t.status === 'wip')
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (wip[0]) return wip[0].title;
  } catch {
    /* ignore */
  }
  return 'Nothing yet';
}

function todayProgressLabel(): string {
  try {
    const settings = readSettings(dataRoot);
    const date = todayDate(settings.timezone);
    const store = readStore(dataRoot, date);
    const stats = statsOf(store.tasks);
    return `${stats.done} done · ${stats.wip} active`;
  } catch {
    return '-';
  }
}

function sendTrayAction(action: string, payload?: Record<string, unknown>) {
  void focusMainWindow().then((win) => {
    win?.webContents.send('tray:action', { action, ...payload });
  });
}

function rebuildTrayMenu() {
  if (!tray) return;
  const working = resolveWorkingOnTitle();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Daybook', enabled: false },
      { label: `● Working on: ${working.slice(0, 48)}`, enabled: false },
      { type: 'separator' },
      {
        label: '+ New Task',
        click: () => sendTrayAction('new-task'),
      },
      {
        label: remindersPaused ? '▶ Resume Reminders' : '⏸ Pause Reminders',
        type: 'checkbox',
        checked: remindersPaused,
        click: () => {
          remindersPaused = !remindersPaused;
          rebuildTrayMenu();
        },
      },
      { type: 'separator' },
      { label: "Today's Progress", enabled: false },
      { label: `  ${todayProgressLabel()}`, enabled: false },
      { type: 'separator' },
      { label: 'Open Daybook', click: () => void focusMainWindow() },
      {
        label: 'Generate EOD',
        click: () => sendTrayAction('eod'),
      },
      {
        label: 'Quit Daybook',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function setupTray() {
  if (tray) {
    try {
      tray.destroy();
    } catch {
      /* ignore */
    }
    tray = null;
  }

  tray = new Tray(loadTrayIcon());
  tray.setToolTip('Daybook');
  rebuildTrayMenu();
  tray.on('double-click', () => void focusMainWindow());
  tray.on('click', () => {
    if (process.platform === 'win32') void focusMainWindow();
  });
  // Refresh working-on / progress periodically
  setInterval(() => rebuildTrayMenu(), 60_000);
}

/**
 * Use Electron login items only. Previously AutoLaunch + setLoginItemSettings
 * both registered, which launched two Daybook processes on Windows login.
 */
function applyAutostart(enabled: boolean) {
  try {
    const legacy = new AutoLaunch({
      name: 'Daybook',
      path: app.getPath('exe'),
      isHidden: false,
    });
    void legacy.disable();
  } catch {
    /* ignore */
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
      path: process.execPath,
      args: [],
    });
  } catch {
    /* ignore on unsupported platforms during dev */
  }
}

function showReminderNotification(body: string) {
  if (!Notification.isSupported()) return;
  const icon = loadAppIcon();
  const notification = new Notification({
    title: 'Daybook',
    body,
    silent: false,
    ...(icon ? { icon } : {}),
  });
  notification.show();
}

function tickReminders() {
  if (remindersPaused) return;
  const settings = readSettings(dataRoot);
  const hourly = shouldFireReminder(settings, 'hourly', lastHourlyKey);
  if (hourly.fire) {
    lastHourlyKey = hourly.key;
    void createWindow('hourly');
    showReminderNotification('Hourly check-in - update your tasks.');
  }
  const eod = shouldFireReminder(settings, 'eod', lastEodKey);
  if (eod.fire) {
    lastEodKey = eod.key;
    void createWindow('eod');
    showReminderNotification('End of day - review and send your email draft.');
  }
}

function startReminderLoop(delayMs = 12_000) {
  if (reminderTimer) clearInterval(reminderTimer);
  // Delay after login/startup so low-end PCs finish boot before timers wake the UI
  const begin = () => {
    if (reminderTimer) clearInterval(reminderTimer);
    reminderTimer = setInterval(tickReminders, 30_000);
    tickReminders();
  };
  setTimeout(begin, Math.max(0, delayMs));
  if (!powerMonitorBound) {
    powerMonitorBound = true;
    powerMonitor.on('resume', () => tickReminders());
    powerMonitor.on('unlock-screen', () => tickReminders());
  }
}

function setupUpdater() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = !isDev;
  autoUpdater.autoInstallOnAppQuit = !isDev;
  if (isDev) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.on('update-available', (info) => {
    markUpdateReady(false);
    mainWindow?.webContents.send('updater:event', { type: 'available', info });
  });
  autoUpdater.on('update-not-available', (info) => {
    markUpdateReady(false);
    mainWindow?.webContents.send('updater:event', { type: 'not-available', info });
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:event', { type: 'progress', progress });
  });
  autoUpdater.on('update-downloaded', (info) => {
    markUpdateReady(true);
    mainWindow?.webContents.send('updater:event', { type: 'downloaded', info });
  });
  autoUpdater.on('error', (err) => {
    markUpdateError(err.message);
    mainWindow?.webContents.send('updater:event', { type: 'error', message: err.message });
  });

  void autoUpdater.checkForUpdates().catch((err) => {
    markUpdateError((err as Error).message);
  });
  if (!isDev) {
    setInterval(() => {
      void autoUpdater.checkForUpdates().catch((err) => {
        markUpdateError((err as Error).message);
      });
    }, 4 * 60 * 60 * 1000);
  }
}

if (gotSingleInstanceLock) {
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    dataRoot = getDataRoot();
    const settings = readSettings(dataRoot);
    applyAutostart(settings.autostart);

    if (!isDev) {
      const outDir = rendererOutDir();
      if (!hasRendererExport(outDir)) {
        dialog.showErrorBox(
          'Daybook UI is missing',
          [
            `No static export found at:\n${outDir}`,
            '',
            'For local development run:',
            '  npm run dev',
            '',
            'To rebuild the packaged UI:',
            '  npm run build:renderer',
          ].join('\n'),
        );
        app.quit();
        return;
      }
      const server = await startStaticServer(outDir);
      staticBaseUrl = `http://127.0.0.1:${server.port}`;
      closeStaticServer = server.close;
      console.log('Serving UI from', outDir, 'at', staticBaseUrl);
    }

    registerIpc({
      getRoot: () => dataRoot,
      getWindow: () => mainWindow,
      applyAutostart,
      createWindow,
      setRemindersPaused: (paused) => {
        remindersPaused = paused;
        rebuildTrayMenu();
      },
      getRemindersPaused: () => remindersPaused,
      rebuildTray: () => rebuildTrayMenu(),
    });

    // One-shot: adopt leftover engine packages after a failed verify (never on every status poll)
    void adoptExistingEngine(dataRoot).catch(() => undefined);

    setupTray();
    // Defer reminder engine so first paint / login stay snappy on low-end PCs
    startReminderLoop(12_000);
    setupUpdater();
    await createWindow(settings.onboardingComplete ? undefined : 'onboarding');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
      else void focusMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    // Keep running in tray on both platforms for reminders
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (reminderTimer) clearInterval(reminderTimer);
    closeStaticServer?.();
    if (tray) {
      try {
        tray.destroy();
      } catch {
        /* ignore */
      }
      tray = null;
    }
  });
}
