import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage, dialog } from 'electron';
import path from 'path';
import { Store } from './store';
import { AudioCapture } from './audio-capture';
import { TextInserter } from './text-inserter';
import { ProviderManager } from './providers';

class OpenTypeApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private store: Store;
  private audioCapture: AudioCapture;
  private textInserter: TextInserter;
  private providerManager: ProviderManager;
  private isRecording = false;

  constructor() {
    this.store = new Store();
    this.audioCapture = new AudioCapture();
    this.textInserter = new TextInserter();
    this.providerManager = new ProviderManager(this.store);
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    
    this.createMainWindow();
    this.createTray();
    this.registerGlobalShortcuts();
    this.setupIpcHandlers();
    
    app.on('window-all-closed', () => {
      // Keep app running in tray on macOS
    });

    app.on('activate', () => {
      if (this.mainWindow === null) {
        this.createMainWindow();
      }
    });

    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
    });
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 700,
      minHeight: 500,
      show: false, // Start hidden, show via tray
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Load renderer
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.on('close', (event) => {
      if (process.platform === 'darwin') {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private createTray(): void {
    // Create a simple tray icon (1x1 transparent for placeholder)
    const icon = nativeImage.createFromBuffer(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4zjOaXUAAAAF5JREFUOE9j/P///38GMgAx8P///38GMoA0w5AJoGJIMwwZAFPD0A0g2QBkGgCrYegGANkAZBqAasg0ANUwZACuYcgAXMOQAbiGIQNwDUMG4BqGDMA1DBmAaxgyAAB5ZhjxX8s8RAAAAABJRU5ErkJggg==',
      'base64'
    ));
    
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Start Dictation',
        accelerator: this.store.get('hotkey') || 'CommandOrControl+Shift+D',
        click: () => this.toggleRecording(),
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => this.showWindow(),
      },
      {
        label: 'Settings',
        click: () => this.showSettings(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.quit(),
      },
    ]);

    this.tray.setToolTip('OpenType - Click to dictate');
    this.tray.setContextMenu(contextMenu);
    
    this.tray.on('click', () => {
      this.toggleRecording();
    });

    this.tray.on('right-click', () => {
      this.tray?.popUpContextMenu(contextMenu);
    });
  }

  private registerGlobalShortcuts(): void {
    const hotkey = this.store.get('hotkey') || 'CommandOrControl+Shift+D';
    
    const registered = globalShortcut.register(hotkey, () => {
      this.toggleRecording();
    });

    if (!registered) {
      console.error('Failed to register global shortcut');
    }
  }

  private setupIpcHandlers(): void {
    // Settings
    ipcMain.handle('store:get', (_, key: string) => this.store.getAny(key));
    ipcMain.handle('store:set', (_, key: string, value: unknown) => {
      this.store.setAny(key, value);
      if (key === 'hotkey' && typeof value === 'string') {
        this.updateHotkey(value);
      }
    });

    // Recording control
    ipcMain.handle('recording:start', () => this.startRecording());
    ipcMain.handle('recording:stop', () => this.stopRecording());
    ipcMain.handle('recording:get-state', () => this.isRecording);

    // Providers
    ipcMain.handle('providers:list', () => this.providerManager.listProviders());
    ipcMain.handle('providers:get-config', (_, id: string) => this.providerManager.getConfig(id));
    ipcMain.handle('providers:set-config', (_, id: string, config: unknown) => 
      this.providerManager.setConfig(id, (config || {}) as any));
    ipcMain.handle('providers:test', (_, id: string) => this.providerManager.testConnection(id));

    // History
    ipcMain.handle('history:get', (_, limit: number) => this.store.getHistory(limit));
    ipcMain.handle('history:delete', (_, id: string) => this.store.deleteHistoryItem(id));
    ipcMain.handle('history:clear', () => this.store.clearHistory());

    // Dictionary
    ipcMain.handle('dictionary:get', () => this.store.getDictionary());
    ipcMain.handle('dictionary:add', (_, word: string, replacement: string) => 
      this.store.addDictionaryEntry(word, replacement));
    ipcMain.handle('dictionary:remove', (_, word: string) => 
      this.store.removeDictionaryEntry(word));

    // Window control
    ipcMain.handle('window:hide', () => this.mainWindow?.hide());
    ipcMain.handle('window:show', () => this.showWindow());
    
    // Text insertion
    ipcMain.handle('text:insert', (_, text: string) => this.textInserter.insert(text));
  }

  private async toggleRecording(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    if (this.isRecording) return;
    
    this.isRecording = true;
    this.updateTrayIcon();
    
    // Notify renderer
    this.mainWindow?.webContents.send('recording:started');
    
    // Start audio capture
    const success = await this.audioCapture.start();
    if (!success) {
      this.isRecording = false;
      this.updateTrayIcon();
      dialog.showErrorBox('Recording Error', 'Failed to start audio capture');
    }
  }

  private async stopRecording(): Promise<void> {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.updateTrayIcon();
    
    // Notify renderer
    this.mainWindow?.webContents.send('recording:stopped');
    
    // Stop audio capture and get file path
    const audioPath = await this.audioCapture.stop();
    
    if (audioPath) {
      // In v1, we just store the path - ASR integration is stubbed
      // Future: send to provider for transcription
      this.handleTranscriptionResult(audioPath);
    }
  }

  private handleTranscriptionResult(audioPath: string): void {
    // v1: Store path as placeholder for actual transcription
    // Future: actual ASR -> LLM processing
    const placeholderText = `[Transcription from: ${path.basename(audioPath)}]`;
    
    // Add to history
    this.store.addHistoryItem({
      id: Date.now().toString(),
      timestamp: Date.now(),
      audioPath,
      text: placeholderText,
      status: 'pending', // pending | completed | error
    });

    // Insert text
    this.textInserter.insert(placeholderText);
    
    // Notify renderer
    this.mainWindow?.webContents.send('transcription:complete', placeholderText);
  }

  private updateHotkey(newHotkey: string): void {
    globalShortcut.unregisterAll();
    const registered = globalShortcut.register(newHotkey, () => {
      this.toggleRecording();
    });
    if (!registered) {
      console.error('Failed to register new hotkey');
    }
  }

  private updateTrayIcon(): void {
    // Update tray icon based on recording state
    // For v1, we just update tooltip
    this.tray?.setToolTip(this.isRecording ? 'OpenType - Recording...' : 'OpenType - Click to dictate');
  }

  private showWindow(): void {
    this.mainWindow?.show();
    this.mainWindow?.focus();
  }

  private showSettings(): void {
    this.showWindow();
    this.mainWindow?.webContents.send('navigate', '/settings');
  }

  private quit(): void {
    globalShortcut.unregisterAll();
    app.quit();
  }
}

const openType = new OpenTypeApp();
openType.initialize().catch(console.error);
