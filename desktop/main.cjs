'use strict';

const { app, BrowserWindow, Menu, net, session, shell } = require('electron');
const { join } = require('node:path');

const PICO_URL = 'https://picompiler.pages.dev/';
const PICO_ORIGIN = new URL(PICO_URL).origin;
const CHECK_URL = new URL('/pico-online.txt', PICO_URL).href;
const RETRY_MS = 5000;

let mainWindow;
let retryTimer = null;
let retryInProgress = false;

function isPicoUrl(value) {
  try { return new URL(value).origin === PICO_ORIGIN; }
  catch { return false; }
}

function openExternalUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.origin !== PICO_ORIGIN) {
      void shell.openExternal(url.href).catch(() => {});
    }
  } catch { /* Never forward unsafe schemes to the operating system. */ }
}

function stopRetry() {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = null;
}

async function tryReconnect(window) {
  if (retryInProgress || window.isDestroyed()) return;
  retryInProgress = true;
  try {
    const response = await net.fetch(`${CHECK_URL}?check=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok && (await response.text()).trim() === 'pico-online' && !window.isDestroyed()) {
      stopRetry();
      await window.loadURL(PICO_URL).catch(() => {});
    }
  } catch {
    // Still offline; keep the fallback and retry later.
  } finally {
    retryInProgress = false;
  }
}

function showOfflineFallback(window) {
  if (window.isDestroyed()) return;
  // The service worker can serve the cached homepage on repeat visits.
  // This local fallback is only for a first launch without any cached shell.
  void window.loadFile(join(__dirname, 'offline.html')).catch(() => {});
  if (!retryTimer) retryTimer = setInterval(() => { void tryReconnect(window); }, RETRY_MS);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 760,
    minHeight: 540,
    backgroundColor: '#1e1e2e',
    show: true,
    autoHideMenuBar: true,
    icon: join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
    },
  });
  mainWindow = window;

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isPicoUrl(url)) return;
    event.preventDefault();
    openExternalUrl(url);
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('did-fail-load', (_event, _code, _description, url, isMainFrame) => {
    if (isMainFrame && isPicoUrl(url)) showOfflineFallback(window);
  });
  window.webContents.on('did-finish-load', () => {
    if (isPicoUrl(window.webContents.getURL())) stopRetry();
  });
  window.on('closed', () => {
    stopRetry();
    if (mainWindow === window) mainWindow = null;
  });

  void window.loadURL(PICO_URL).catch(() => {});
}

app.whenReady().then(() => {
  app.setName('Pico');
  // The desktop wrapper never needs microphone, camera or location access.
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'clipboard-sanitized-write');
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission) => {
    return permission === 'clipboard-sanitized-write';
  });
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopRetry();
  if (process.platform !== 'darwin') app.quit();
});
