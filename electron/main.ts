import {
  app,
  BrowserWindow,
  Notification,
  Tray,
  Menu,
  nativeImage,
  powerMonitor,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import AutoLaunch from 'auto-launch';
import { autoUpdater } from 'electron-updater';
import { DataRoot, readSettings } from '../shared/store';
import { shouldFireReminder } from './scheduler/reminders';
import { markUpdateError, markUpdateReady, queueReminder, registerIpc } from './ipc/handlers';
import { rendererOutDir, startStaticServer, WTT_UI_PORT } from './static-server';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let dataRoot: DataRoot;
let lastHourlyKey: string | null = null;
let lastEodKey: string | null = null;
let reminderTimer: NodeJS.Timeout | null = null;
let staticBaseUrl: string | null = null;
let closeStaticServer: (() => void) | null = null;
let isQuitting = false;

const isDev = process.env.ELECTRON_DEV === '1';

/** Only one Daybook process — prevents duplicate windows + tray icons on Windows. */
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _argv) => {
    void focusMainWindow();
  });
}

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

/** Windows tray needs a small opaque icon; empty/transparent icons look missing. */
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

function deliverReminder(mode: string) {
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

async function focusMainWindow(mode?: string): Promise<BrowserWindow> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return createWindow(mode);
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (mode === 'hourly' || mode === 'eod') {
    queueReminder(mode);
    if (!isBoardUrl(mainWindow.webContents.getURL())) {
      await new Promise<void>((resolve) => {
        mainWindow!.webContents.once('did-finish-load', () => resolve());
        void mainWindow!.loadURL(rendererUrl('/'));
      });
    }
    setTimeout(() => deliverReminder(mode), 150);
  }
  return mainWindow;
}

async function createWindow(mode?: string): Promise<BrowserWindow> {
  const isReminder = mode === 'hourly' || mode === 'eod';
  if (isReminder) queueReminder(mode);

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (mode === 'onboarding') {
      await mainWindow.loadURL(rendererUrl('/onboarding/'));
      return mainWindow;
    }
    if (isReminder) {
      if (!isBoardUrl(mainWindow.webContents.getURL())) {
        await new Promise<void>((resolve) => {
          mainWindow!.webContents.once('did-finish-load', () => resolve());
          void mainWindow!.loadURL(rendererUrl('/'));
        });
      }
      setTimeout(() => deliverReminder(mode!), 150);
    }
    return mainWindow;
  }

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
    },
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('Renderer failed to load', { code, desc, url });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isReminder && mode) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => deliverReminder(mode), 250);
    });
  }

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
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open board', click: () => void focusMainWindow() },
      { label: 'Hourly reminder now', click: () => void createWindow('hourly') },
      { label: 'EOD email now', click: () => void createWindow('eod') },
      { type: 'separator' },
      {
        label: 'Quit Daybook',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('double-click', () => void focusMainWindow());
  tray.on('click', () => {
    if (process.platform === 'win32') void focusMainWindow();
  });
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

function tickReminders() {
  const settings = readSettings(dataRoot);
  const hourly = shouldFireReminder(settings, 'hourly', lastHourlyKey);
  if (hourly.fire) {
    lastHourlyKey = hourly.key;
    void createWindow('hourly');
    if (Notification.isSupported()) {
      new Notification({
        title: 'Daybook',
        body: 'Hourly check-in — update your tasks.',
      }).show();
    }
  }
  const eod = shouldFireReminder(settings, 'eod', lastEodKey);
  if (eod.fire) {
    lastEodKey = eod.key;
    void createWindow('eod');
    if (Notification.isSupported()) {
      new Notification({
        title: 'Daybook',
        body: 'End of day — review and send your email draft.',
      }).show();
    }
  }
}

function startReminderLoop() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = setInterval(tickReminders, 30_000);
  powerMonitor.on('resume', () => tickReminders());
  powerMonitor.on('unlock-screen', () => tickReminders());
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
    });

    setupTray();
    startReminderLoop();
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
