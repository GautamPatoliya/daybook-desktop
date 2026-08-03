import {
  app,
  BrowserWindow,
  Notification,
  Tray,
  Menu,
  nativeImage,
  powerMonitor,
} from 'electron';
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

const isDev = process.env.ELECTRON_DEV === '1';

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

async function createWindow(mode?: string) {
  const isReminder = mode === 'hourly' || mode === 'eod';
  if (isReminder) queueReminder(mode);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    if (mode === 'onboarding') {
      await mainWindow.loadURL(rendererUrl('/onboarding/'));
      return mainWindow;
    }
    if (isReminder) {
      const current = mainWindow.webContents.getURL();
      if (!isBoardUrl(current)) {
        await new Promise<void>((resolve) => {
          mainWindow!.webContents.once('did-finish-load', () => resolve());
          void mainWindow!.loadURL(rendererUrl('/'));
        });
      }
      // Give React a tick to subscribe, then deliver (also available via reminder:consume)
      setTimeout(() => deliverReminder(mode!), 150);
      return mainWindow;
    }
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#000000',
    title: 'Daybook',
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function setupTray() {
  const img = nativeImage.createEmpty();
  tray = new Tray(
    img.isEmpty()
      ? nativeImage.createFromDataURL(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFElEQVQ4T2NkYGD4z0ABYBzVMKoaBgYA4gIBoH8p5m0AAAAASUVORK5CYII=',
        )
      : img,
  );
  tray.setToolTip('Daybook');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open board', click: () => void createWindow() },
      { label: 'Hourly reminder now', click: () => void createWindow('hourly') },
      { label: 'EOD email now', click: () => void createWindow('eod') },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
  tray.on('double-click', () => void createWindow());
}

function applyAutostart(enabled: boolean) {
  const launcher = new AutoLaunch({
    name: 'Daybook',
    path: app.getPath('exe'),
    isHidden: false,
  });
  if (enabled) void launcher.enable();
  else void launcher.disable();

  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
      path: process.execPath,
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
  // Dev builds are unpackaged; force the GitHub feed via dev-app-update.yml so
  // "Check for updates" can be verified without a full installer each time.
  // Do not auto-download/install from `npm run dev` — that path is for detection only.
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
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on both platforms for reminders
});

app.on('before-quit', () => {
  if (reminderTimer) clearInterval(reminderTimer);
  closeStaticServer?.();
});
