import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, ipcMain, dialog, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

let mainWindow: BrowserWindow | null = null;
let state: UpdateState = { status: 'idle' };

function sendToRenderer(state: UpdateState) {
  mainWindow?.webContents.send('update:state', state);
}

function setState(partial: Partial<UpdateState>) {
  state = { ...state, ...partial };
  sendToRenderer(state);
}

function isAppPathWritable(): boolean {
  try {
    const testFile = path.join(app.getAppPath(), `.opetype-updater-test-${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window;

  // IMPORTANT: electron-builder for mac-only generates latest-mac.yml
  // autoUpdater looks for this automatically when provider is github
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const notes = typeof info.releaseNotes === 'string'
      ? info.releaseNotes
      : (info.releaseNotes as any[])?.map(n => n.note).join('\n') || '';
    setState({
      status: 'available',
      version: info.version,
      releaseNotes: notes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    setState({ status: 'idle' });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    setState({
      status: 'downloading',
      progress: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    setState({ status: 'downloaded' });
  });

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error);
    setState({ status: 'error', error: error.message });
  });
}

export async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (error: any) {
    console.error('[AutoUpdater] Check failed:', error);
    setState({ status: 'error', error: error?.message });
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    const result = await autoUpdater.downloadUpdate();
    console.log('[AutoUpdater] Download result:', result);
  } catch (error: any) {
    console.error('[AutoUpdater] Download failed:', error);
    setState({ status: 'error', error: error?.message });
  }
}

export function installUpdate(): void {
  if (!isAppPathWritable()) {
    const msg = 'OpenType 无法自动更新，因为它正从 DMG 直接运行。请先将 OpenType 拖到「应用程序」(Applications) 文件夹中，然后再试。';
    console.error('[AutoUpdater]', msg);
    setState({ status: 'error', error: msg });
    dialog.showErrorBox('无法更新', msg);
    return;
  }

  try {
    autoUpdater.quitAndInstall(false, true);
  } catch (error: any) {
    console.error('[AutoUpdater] Install failed:', error);
    setState({ status: 'error', error: error?.message });
  }
}

export function getUpdateState(): UpdateState {
  return state;
}

// IPC handlers
export function setupAutoUpdaterIpc() {
  ipcMain.handle('update:check', () => checkForUpdates());
  ipcMain.handle('update:download', () => downloadUpdate());
  ipcMain.handle('update:install', () => installUpdate());
  ipcMain.handle('update:state', () => getUpdateState());
}
