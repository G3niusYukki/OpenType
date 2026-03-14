import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage, dialog } from 'electron';
import path from 'path';
import { Store } from './store';
import { AudioCapture } from './audio-capture';
import { TextInserter } from './text-inserter';
import { ProviderManager } from './providers';
import { TranscriptionService, TranscriptionResult } from './transcription';

class OpenTypeApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private store: Store;
  private audioCapture: AudioCapture;
  private textInserter: TextInserter;
  private providerManager: ProviderManager;
  private transcriptionService: TranscriptionService;
  private isRecording = false;
  private currentAudioPath: string | null = null;

  constructor() {
    this.store = new Store();
    this.audioCapture = new AudioCapture();
    this.textInserter = new TextInserter();
    this.providerManager = new ProviderManager(this.store);
    this.transcriptionService = new TranscriptionService({
      language: this.store.get('language')?.split('-')[0] || 'en',
      useLocalFirst: true,
      openaiApiKey: this.getOpenAIKey()
    });
  }

  private getOpenAIKey(): string | undefined {
    const providers = this.store.get('providers');
    const openai = providers.find(p => p.id === 'openai');
    return openai?.apiKey;
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    
    this.createMainWindow();
    this.createTray();
    this.registerGlobalShortcuts();
    this.setupIpcHandlers();
    
    // Log system status on startup
    this.logSystemStatus();
    
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

  private async logSystemStatus(): Promise<void> {
    try {
      const status = await this.transcriptionService.getStatus();
      console.log('[OpenType] System Status:');
      console.log(`  - whisper.cpp: ${status.whisperInstalled ? '✅' : '❌'} ${status.whisperPath || ''}`);
      console.log(`  - Model: ${status.modelAvailable ? '✅' : '❌'} ${status.modelPath || ''}`);
      
      if (status.recommendations.length > 0) {
        console.log('[OpenType] Setup needed:');
        status.recommendations.forEach(r => console.log(`    ${r}`));
      }
    } catch (error) {
      console.error('[OpenType] Failed to get system status:', error);
    }
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
      if (key === 'language' && typeof value === 'string') {
        this.transcriptionService.updateConfig({
          language: value.split('-')[0]
        });
      }
    });

    // Recording control
    ipcMain.handle('recording:start', () => this.startRecording());
    ipcMain.handle('recording:stop', () => this.stopRecording());
    ipcMain.handle('recording:get-state', () => this.isRecording);

    // Providers
    ipcMain.handle('providers:list', () => this.providerManager.listProviders());
    ipcMain.handle('providers:get-config', (_, id: string) => this.providerManager.getConfig(id));
    ipcMain.handle('providers:set-config', (_, id: string, config: unknown) => {
      const result = this.providerManager.setConfig(id, (config || {}) as any);
      // Update transcription service if OpenAI key changed
      if (id === 'openai') {
        this.transcriptionService.updateConfig({
          openaiApiKey: (config as any)?.apiKey
        });
      }
      return result;
    });
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
    
    // Transcription status
    ipcMain.handle('transcription:status', async () => {
      return this.transcriptionService.getStatus();
    });
    
    // Audio devices
    ipcMain.handle('audio:devices', async () => {
      return this.audioCapture.getAudioDevices();
    });
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
    const result = await this.audioCapture.start();
    
    if (!result.success || !result.audioPath) {
      this.isRecording = false;
      this.updateTrayIcon();
      dialog.showErrorBox('Recording Error', result.error || 'Failed to start audio capture');
      return;
    }
    
    this.currentAudioPath = result.audioPath;
    
    if (result.isPlaceholder) {
      console.warn('[OpenType] Recording in placeholder mode - ffmpeg not available');
    }
  }

  private async stopRecording(): Promise<void> {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.updateTrayIcon();
    
    // Notify renderer
    this.mainWindow?.webContents.send('recording:stopped');
    
    // Stop audio capture and get file path
    const result = await this.audioCapture.stop();
    
    if (!result.success || !result.audioPath) {
      dialog.showErrorBox('Recording Error', result.error || 'Failed to stop recording');
      return;
    }
    
    const audioPath = result.audioPath;
    this.currentAudioPath = null;
    
    // Transcribe the audio
    this.mainWindow?.webContents.send('transcription:started');
    
    try {
      const transcriptionResult = await this.transcribeAudio(audioPath);
      this.handleTranscriptionResult(audioPath, transcriptionResult);
    } catch (error: any) {
      console.error('[OpenType] Transcription error:', error);
      this.handleTranscriptionResult(audioPath, {
        success: false,
        error: error?.message || 'Transcription failed',
        provider: 'none'
      });
    }
  }

  private async transcribeAudio(audioPath: string): Promise<TranscriptionResult> {
    // Update config from store before transcribing
    const providers = this.store.get('providers');
    const openaiProvider = providers.find(p => p.id === 'openai');
    
    this.transcriptionService.updateConfig({
      language: this.store.get('language')?.split('-')[0] || 'en',
      openaiApiKey: openaiProvider?.apiKey,
      useLocalFirst: true
    });
    
    return this.transcriptionService.transcribe(audioPath);
  }

  private handleTranscriptionResult(audioPath: string, result: TranscriptionResult): void {
    const text = result.text || '';
    const status = result.success ? 'completed' : 'error';
    
    // Apply dictionary replacements
    const finalText = this.store.applyDictionary(text);
    
    // Add to history
    this.store.addHistoryItem({
      id: Date.now().toString(),
      timestamp: Date.now(),
      audioPath,
      text: finalText,
      status,
    });

    // Insert text if successful
    if (result.success && finalText) {
      this.textInserter.insert(finalText);
    }
    
    // Notify renderer
    this.mainWindow?.webContents.send('transcription:complete', {
      text: finalText,
      success: result.success,
      provider: result.provider,
      error: result.error
    });
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
