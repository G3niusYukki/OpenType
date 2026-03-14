import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage, dialog } from 'electron';
import path from 'path';
import { Store, ProviderConfig } from './store';
import { AudioCapture } from './audio-capture';
import { TextInserter } from './text-inserter';
import type { InsertionResult } from './text-inserter';
import { ProviderManager } from './providers';
import { TranscriptionService, TranscriptionResult, CloudProviderConfig } from './transcription';
import { AiPostProcessor, AiPostProcessingResult } from './aiPostProcessor';

class OpenTypeApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private store: Store;
  private audioCapture: AudioCapture;
  private textInserter: TextInserter;
  private providerManager: ProviderManager;
  private transcriptionService: TranscriptionService;
  private aiPostProcessor: AiPostProcessor;
  private isRecording = false;
  private currentAudioPath: string | null = null;

  constructor() {
    this.store = new Store();
    this.audioCapture = new AudioCapture();
    this.textInserter = new TextInserter();
    this.providerManager = new ProviderManager(this.store);
    this.aiPostProcessor = new AiPostProcessor(this.store, this.providerManager);

    // Detect system language for transcription
    const systemLang = process.env.LANG || process.env.LC_ALL || 'en-US';
    const defaultLang = systemLang.split('_')[0].split('.')[0];
    const savedLang = this.store.get('language');
    const transcriptionLang = savedLang ? savedLang.split('-')[0] : defaultLang;

    console.log(`[OpenType] System language: ${defaultLang}, Transcription language: ${transcriptionLang}`);

    this.transcriptionService = new TranscriptionService({
      language: transcriptionLang,
      useLocalFirst: true,
      preferredProvider: this.store.get('preferredProvider') || 'auto',
      cloudProviders: this.getCloudProviderConfigs()
    });
  }

  private getCloudProviderConfigs(): CloudProviderConfig[] {
    const providers = this.store.get('providers');
    // Only include providers that support audio transcription
    // DeepSeek, Zhipu, MiniMax, Moonshot are text-only LLMs for post-processing, not audio transcription
    const audioTranscriptionProviders = ['openai', 'groq'];
    return providers
      .filter((p): p is ProviderConfig & { id: 'openai' | 'groq'; apiKey: string } => 
        p.enabled && !!p.apiKey && audioTranscriptionProviders.includes(p.id)
      )
      .map(p => ({
        id: p.id,
        name: p.name,
        apiKey: p.apiKey,
        baseUrl: p.baseUrl,
        model: p.model,
        enabled: p.enabled
      }));
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    
    this.createMainWindow();
    this.createTray();
    this.registerGlobalShortcuts();
    this.setupIpcHandlers();
    this.setupSignalHandlers();
    
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
      show: true, // Show automatically for local testing
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[OpenType] Renderer failed to load:', { errorCode, errorDescription, validatedURL });
      dialog.showErrorBox('Renderer Load Failed', `${errorDescription} (${errorCode})\n${validatedURL}`);
    });

    this.mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[OpenType] Renderer process gone:', details);
      dialog.showErrorBox('Renderer Crashed', JSON.stringify(details));
    });

    this.mainWindow.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) {
        console.error('[Renderer console]', message);
      }
    });

    // Load renderer
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5187');
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.on('unresponsive', () => {
      console.error('[OpenType] Main window became unresponsive');
    });

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
        const langCode = value.split('-')[0];
        this.transcriptionService.updateConfig({
          language: langCode
        });
        console.log(`[OpenType] Language updated to: ${langCode}`);
      }
      if (key === 'preferredProvider' && typeof value === 'string') {
        this.transcriptionService.updateConfig({
          preferredProvider: value as 'local' | 'cloud' | 'auto'
        });
      }
    });

    // Recording control
    ipcMain.handle('recording:start', () => this.startRecording());
    ipcMain.handle('recording:stop', () => this.stopRecording());
    ipcMain.handle('recording:get-state', () => this.isRecording);

    // Providers
    ipcMain.handle('providers:list', () => this.providerManager.listProviders());
    ipcMain.handle('providers:list-transcription', () => this.providerManager.listTranscriptionProviders());
    ipcMain.handle('providers:list-post-processing', () => this.providerManager.listPostProcessingProviders());
    ipcMain.handle('providers:get-config', (_, id: string) => this.providerManager.getConfig(id));
    ipcMain.handle('providers:set-config', (_, id: string, config: unknown) => {
      const result = this.providerManager.setConfig(id, (config || {}) as any);
      // Update transcription service when any provider config changes
      this.transcriptionService.updateConfig({
        cloudProviders: this.getCloudProviderConfigs()
      });
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
    ipcMain.handle('text:insert', async (_, text: string) => {
      return await this.textInserter.insert(text);
    });
    
    // Transcription status
    ipcMain.handle('transcription:status', async () => {
      return this.transcriptionService.getStatus();
    });
    
    // Audio status
    ipcMain.handle('audio:status', async () => {
      return this.audioCapture.getStatus();
    });
    
    // Audio devices
    ipcMain.handle('audio:devices', async () => {
      return this.audioCapture.getAudioDevices();
    });

    // AI Post-Processing
    ipcMain.handle('ai:get-settings', () => this.store.get('aiPostProcessing'));
    ipcMain.handle('ai:set-settings', (_, settings) => {
      this.store.set('aiPostProcessing', { ...this.store.get('aiPostProcessing'), ...settings });
    });
    ipcMain.handle('ai:test', async (_, text: string) => {
      return await this.aiPostProcessor.process(text);
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
    let result;
    try {
      result = await this.audioCapture.stop();
    } catch (error: any) {
      console.error('[OpenType] Audio capture stop failed:', error);
      dialog.showErrorBox('Recording Error', error?.message || 'Failed to stop recording');
      return;
    }
    
    if (!result.success || !result.audioPath) {
      const errorMsg = result.error || 'Failed to stop recording';
      dialog.showErrorBox('Recording Error', errorMsg);
      return;
    }
    
    const audioPath = result.audioPath;
    this.currentAudioPath = null;
    
    // Transcribe the audio
    this.mainWindow?.webContents.send('transcription:started');
    
    try {
      const transcriptionResult = await this.transcribeAudio(audioPath);
      await this.handleTranscriptionResult(audioPath, transcriptionResult);
    } catch (error: any) {
      console.error('[OpenType] Transcription error:', error);
      // Ensure we always handle the result gracefully, even on unexpected errors
      await this.handleTranscriptionResult(audioPath, {
        success: false,
        error: error?.message || 'Transcription failed unexpectedly',
        provider: 'none'
      });
    }
  }

  private async transcribeAudio(audioPath: string): Promise<TranscriptionResult> {
    // Update config from store before transcribing
    this.transcriptionService.updateConfig({
      language: this.store.get('language')?.split('-')[0] || 'en',
      cloudProviders: this.getCloudProviderConfigs(),
      useLocalFirst: true
    });
    
    return this.transcriptionService.transcribe(audioPath);
  }

  private async handleTranscriptionResult(audioPath: string, result: TranscriptionResult): Promise<void> {
    try {
      const rawText = result.text || '';
      const status = result.success ? 'completed' : 'error';

      let processedText = rawText;
      let aiResult: AiPostProcessingResult | null = null;

      if (result.success && rawText) {
        const aiSettings = this.store.get('aiPostProcessing');
        if (aiSettings?.enabled && this.aiPostProcessor.isAvailable()) {
          try {
            console.log('[OpenType] Starting AI post-processing...');
            aiResult = await this.aiPostProcessor.process(rawText, aiSettings.options);
            if (aiResult.success) {
              processedText = aiResult.processedText;
              console.log(`[OpenType] AI processing complete in ${aiResult.latencyMs}ms`);
            } else {
              console.warn('[OpenType] AI processing failed:', aiResult.error);
            }
          } catch (aiError) {
            console.error('[OpenType] AI post-processing error:', aiError);
          }
        }
      }

      // Apply dictionary replacements
      let finalText: string;
      try {
        finalText = this.store.applyDictionary(processedText);
      } catch (dictError) {
        console.error('[OpenType] Dictionary application failed:', dictError);
        finalText = processedText;
      }

      try {
        this.store.addHistoryItem({
          id: Date.now().toString(),
          timestamp: Date.now(),
          audioPath,
          rawText,
          text: finalText,
          processedText: aiResult?.processedText,
          aiChanges: aiResult?.changes,
          status,
          provider: result.provider,
          aiProvider: aiResult?.provider,
        });
      } catch (historyError) {
        console.error('[OpenType] Failed to add history item:', historyError);
      }

      // Insert text if successful and track fallback state
      let fallbackToClipboard = false;
      let insertResult: InsertionResult = { success: false, method: 'failed', text: finalText, accessibilityRequired: false };

      if (result.success && finalText) {
        try {
          insertResult = await this.textInserter.insert(finalText);
          fallbackToClipboard = insertResult.method === 'clipboard';
        } catch (insertError) {
          console.error('[OpenType] Text insertion failed:', insertError);
          fallbackToClipboard = true;
        }

        // Show accessibility warning if needed
        if (insertResult.accessibilityRequired) {
          try {
            this.mainWindow?.webContents.send('notification', {
              type: 'warning',
              title: 'Accessibility Permission Required',
              message: 'OpenType needs Accessibility permission to paste text. Text has been copied to clipboard.',
              action: {
                label: 'Open Settings',
                command: 'open:x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
              }
            });
          } catch (notifError) {
            console.error('[OpenType] Failed to send notification:', notifError);
          }
        }
      }

      try {
        const providerNameMap: Record<string, string> = {
          'openai': 'OpenAI',
          'groq': 'Groq',
          'anthropic': 'Anthropic',
          'deepseek': 'DeepSeek',
          'zhipu': '智谱 GLM',
          'minimax': 'MiniMax',
          'moonshot': 'Kimi',
          'whisper.cpp': 'whisper.cpp',
          'local': 'Local',
          'none': 'None'
        };
        const providerDisplayName = providerNameMap[result.provider] || result.provider;

        this.mainWindow?.webContents.send('transcription:complete', {
          rawText,
          processedText: finalText,
          text: finalText,
          aiProcessed: aiResult?.success || false,
          aiChanges: aiResult?.changes,
          aiLatency: aiResult?.latencyMs,
          aiProvider: aiResult?.provider,
          success: result.success,
          provider: providerDisplayName,
          error: result.error,
          fallbackToClipboard
        });
      } catch (sendError) {
        console.error('[OpenType] Failed to send transcription:complete:', sendError);
      }
    } catch (error) {
      console.error('[OpenType] Unexpected error in handleTranscriptionResult:', error);
      // Last resort error handling - ensure we don't crash the app
      try {
        this.mainWindow?.webContents.send('transcription:complete', {
          text: '',
          success: false,
          provider: 'none',
          error: 'Internal error processing transcription',
          fallbackToClipboard: false
        });
      } catch {
        // Ignore errors in error handling
      }
    }
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
    this.tray?.destroy();
    app.quit();
  }

  private setupSignalHandlers(): void {
    const cleanup = () => {
      console.log('[OpenType] Cleaning up before exit...');
      globalShortcut.unregisterAll();
      this.tray?.destroy();
      app.quit();
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  }
}

process.on('uncaughtException', (error) => {
  console.error('[OpenType] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[OpenType] Unhandled rejection:', reason);
});

const openType = new OpenTypeApp();
openType.initialize().catch(console.error);
