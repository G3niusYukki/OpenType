import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage, dialog, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import { Store, ProviderConfig } from './store';
import { AudioCapture } from './audio-capture';
import { TextInserter } from './text-inserter';
import type { InsertionResult } from './text-inserter';
import { ProviderManager } from './providers';
import { TranscriptionService, TranscriptionResult, CloudProviderConfig, CloudProviderType } from './transcription';
import { AiPostProcessor, AiPostProcessingResult } from './aiPostProcessor';
import { GlobalKeyboardMonitor } from './keyboard-monitor';
import { DiagnosticsService } from './diagnostics';
import { AudioDeviceManager } from './audio-device-manager';
import { secureStorage } from './secure-storage';
import { ProfileManager } from './profile-manager';
import { TranscriptionStream } from './transcription-stream';
import { agentCommunication } from './agent-communication';
import { parseVoiceInput, removeLastSentence } from './voice-commands';

type RecordingMode = 'default' | 'handsfree' | 'translate' | 'edit';

export class OpenTypeApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private store: Store;
  private audioCapture: AudioCapture;
  private textInserter: TextInserter;
  private providerManager: ProviderManager;
  private transcriptionService: TranscriptionService | null = null;
  private aiPostProcessor: AiPostProcessor;
  private keyboardMonitors: Map<string, GlobalKeyboardMonitor> = new Map();
  private isRecording = false;
  private isQuitting = false;
  private currentAudioPath: string | null = null;
  private recordingMode: RecordingMode = 'default';
  private selectedTextBeforeRecording: string = '';
  private holdModeActive: boolean = false;
  private diagnosticsService: DiagnosticsService;
  private audioDeviceManager: AudioDeviceManager;
  private transcriptionLanguage: string;
  private profileManager: ProfileManager;
  private transcriptionStream: TranscriptionStream | null = null;

  constructor() {
    this.store = new Store();
    this.audioCapture = new AudioCapture();
    this.textInserter = new TextInserter();
    this.providerManager = new ProviderManager(this.store);
    this.aiPostProcessor = new AiPostProcessor(this.store, this.providerManager);
    this.diagnosticsService = new DiagnosticsService();
    this.audioDeviceManager = new AudioDeviceManager(this.audioCapture, this.store);
    this.profileManager = new ProfileManager(this.store);

    // Detect system language for transcription
    const systemLang = process.env.LANG || process.env.LC_ALL || 'en-US';
    const defaultLang = systemLang.split('_')[0].split('.')[0];
    const savedLang = this.store.get('language');
    const transcriptionLang = savedLang ? savedLang.split('-')[0] : defaultLang;

    console.log(`[OpenType] System language: ${defaultLang}, Transcription language: ${transcriptionLang}`);

    this.transcriptionLanguage = transcriptionLang;
  }

  private async getCloudProviderConfigs(): Promise<CloudProviderConfig[]> {
    const providers = this.store.get('providers');
    const audioTranscriptionProviders = ['openai', 'groq', 'aliyun-asr', 'tencent-asr', 'baidu-asr', 'iflytek-asr'];

    const configs: CloudProviderConfig[] = [];

    for (const p of providers) {
      const isEnabled = p.enabledForTranscription ?? p.enabled;
      if (!isEnabled || !audioTranscriptionProviders.includes(p.id)) continue;

      // Handle providers with multiple credentials (like Alibaba Cloud)
      if (p.id === 'aliyun-asr') {
        const accessKeyId = await secureStorage.getProviderCredential(p.id, 'accessKeyId');
        const accessKeySecret = await secureStorage.getProviderCredential(p.id, 'accessKeySecret');
        if (!accessKeyId || !accessKeySecret) continue;

        configs.push({
          id: p.id as CloudProviderType,
          name: p.name,
          credentials: { accessKeyId, accessKeySecret },
          baseUrl: p.baseUrl,
          model: p.model,
          enabled: isEnabled,
          region: p.region
        });
        continue;
      }

      // Get API key from secure storage for other providers
      const apiKey = await secureStorage.getProviderApiKey(p.id);
      if (!apiKey) continue;

      configs.push({
        id: p.id as CloudProviderType,
        name: p.name,
        apiKey,
        baseUrl: p.baseUrl,
        model: p.model,
        enabled: isEnabled
      });
    }

    return configs;
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    
    // Initialize secure storage
    await secureStorage.initialize();

    // Check for migration and migrate API keys if needed
    if (secureStorage.isMigrationNeeded(this.store)) {
      console.log('[OpenType] Migrating API keys to secure storage...');
      const result = await secureStorage.migrateFromPlaintext(this.store);
      if (result.success) {
        console.log(`[OpenType] Successfully migrated ${result.migrated} API keys to secure storage`);
      } else {
        console.error('[OpenType] Migration errors:', result.errors);
      }
    }

    this.transcriptionService = new TranscriptionService({
      language: this.transcriptionLanguage,
      useLocalFirst: true,
      preferredProvider: this.store.get('preferredProvider') || 'auto',
      cloudProviders: await this.getCloudProviderConfigs()
    });

    this.createMainWindow();
    this.createTray();
    this.registerGlobalShortcuts();
    this.setupIpcHandlers();
    this.setupSignalHandlers();

    this.profileManager.startMonitoring();

    // Start agent communication server
    agentCommunication.start();

    // Request microphone permission on first launch
    this.requestMicrophonePermission();

    this.logSystemStatus();

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (this.mainWindow === null) {
        this.createMainWindow();
      } else {
        this.mainWindow?.show();
      }
    });

    app.on('before-quit', async (event) => {
      event.preventDefault();
      this.isQuitting = true;

      if (this.isRecording) {
        await this.stopRecording();
      }

      if (this.transcriptionStream) {
        this.transcriptionStream.stop();
        this.transcriptionStream = null;
      }

      await this.audioCapture.stop();

      globalShortcut.unregisterAll();
      this.keyboardMonitors.forEach((monitor) => monitor.stopMonitoring());
      this.keyboardMonitors.clear();
      this.profileManager.stopMonitoring();

      // Stop agent communication server
      agentCommunication.stop();

      if (this.tray) {
        this.tray.destroy();
        this.tray = null;
      }

      this.mainWindow?.destroy();
      this.mainWindow = null;

      app.exit(0);
    });
  }

  private async requestMicrophonePermission(): Promise<void> {
    try {
      const { systemPreferences } = await import('electron');
      const status = systemPreferences.getMediaAccessStatus('microphone');
      console.log(`[OpenType] Microphone permission status: ${status}`);

      if (status === 'not-determined') {
        console.log('[OpenType] Requesting microphone permission...');
        const granted = await systemPreferences.askForMediaAccess('microphone');
        console.log(`[OpenType] Microphone permission ${granted ? 'granted' : 'denied'}`);
      }
    } catch (error) {
      console.error('[OpenType] Failed to request microphone permission:', error);
    }
  }

  private async logSystemStatus(): Promise<void> {
    try {
      if (!this.transcriptionService) {
        console.log('[OpenType] Transcription service not initialized yet');
        return;
      }
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
      if (process.platform === 'darwin' && !this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private trayIcons: { idle: Electron.NativeImage; recording: Electron.NativeImage } | null = null;

  private createTrayIcons(): { idle: Electron.NativeImage; recording: Electron.NativeImage } {
    if (this.trayIcons) return this.trayIcons;

    this.trayIcons = {
      idle: nativeImage.createFromBuffer(Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4zjOaXUAAAAF5JREFUOE9j/P///38GMgAx8P///38GMoA0w5AJoGJIMwwZAFPD0A0g2QBkGgCrYegGANkAZBqAasg0ANUwZACuYcgAXMOQAbiGIQNwDUMG4BqGDMA1DBmAaxgyAAB5ZhjxX8s8RAAAAABJRU5ErkJggg==',
        'base64'
      )).resize({ width: 16, height: 16 }),
      recording: nativeImage.createFromBuffer(Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4zjOaXUAAAAE5JREFUOE9j/P///38GMgAx8P///38GMoA0w5AJoGJIMwwZAFPD0A0g2QBkGgCrYegGANkAZBqAasg0ANUwZACuYcgAXMOQAbiGIQNwDUMG4BqGDMA1DBmAaxgyAAD5ZhjxX8s8RAAAAABJRU5ErkJggg==',
        'base64'
      )).resize({ width: 16, height: 16 }),
    };

    return this.trayIcons;
  }

  private createTray(): void {
    const icons = this.createTrayIcons();
    this.tray = new Tray(icons.idle);
    this.tray.setToolTip('OpenType - Click to dictate');

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

    this.tray.setContextMenu(contextMenu);

    this.tray.on('click', () => {
      this.toggleRecording();
    });

    this.tray.on('right-click', () => {
      this.tray?.popUpContextMenu(contextMenu);
    });
  }

  private registerGlobalShortcuts(): void {
    this.keyboardMonitors.forEach((monitor) => monitor.stopMonitoring());
    this.keyboardMonitors.clear();
    globalShortcut.unregisterAll();

    const voiceInputModes = this.store.get('voiceInputModes') || {
      basicVoiceInput: true,
      handsFreeMode: true,
      translateToEnglish: true,
      editSelectedText: true,
    };

    // Basic Voice Input (Default) - HOLD MODE
    if (voiceInputModes.basicVoiceInput !== false) {
      const hotkey = this.store.get('hotkey') || 'CommandOrControl+Shift+D';
      const { key, modifiers } = this.parseHotkey(hotkey);
      
      const monitor = new GlobalKeyboardMonitor('basic');
      monitor.startMonitoring(
        key,
        modifiers,
        () => {
          if (!this.isRecording && !this.holdModeActive) {
            this.holdModeActive = true;
            this.startRecording('default');
          }
        },
        () => {
          if (this.isRecording && this.holdModeActive) {
            this.holdModeActive = false;
            this.stopRecording();
          }
        }
      );
      this.keyboardMonitors.set('basic', monitor);
      console.log(`[OpenType] Registered hold-to-speak shortcut: ${hotkey}`);
    }

    // Hands-free Mode - TOGGLE MODE
    if (voiceInputModes.handsFreeMode) {
      const handsFreeHotkey = this.store.get('handsFreeHotkey') || 'CommandOrControl+Space';
      const registered = globalShortcut.register(handsFreeHotkey, () => {
        this.toggleRecording('handsfree');
      });
      if (registered) {
        console.log(`[OpenType] Registered hands-free toggle shortcut: ${handsFreeHotkey}`);
      } else {
        console.error('[OpenType] Failed to register hands-free shortcut');
      }
    }

    // Translate to English Mode - HOLD MODE
    if (voiceInputModes.translateToEnglish) {
      const translateHotkey = this.store.get('translateHotkey') || 'CommandOrControl+Shift+T';
      const { key, modifiers } = this.parseHotkey(translateHotkey);
      
      const monitor = new GlobalKeyboardMonitor('translate');
      monitor.startMonitoring(
        key,
        modifiers,
        () => {
          if (!this.isRecording && !this.holdModeActive) {
            this.holdModeActive = true;
            this.startRecording('translate');
          }
        },
        () => {
          if (this.isRecording && this.holdModeActive) {
            this.holdModeActive = false;
            this.stopRecording();
          }
        }
      );
      this.keyboardMonitors.set('translate', monitor);
      console.log(`[OpenType] Registered translate shortcut: ${translateHotkey}`);
    }

    // Edit Selected Text Mode - HOLD MODE
    if (voiceInputModes.editSelectedText) {
      const editTextHotkey = this.store.get('editTextHotkey') || 'CommandOrControl+Shift+E';
      const { key, modifiers } = this.parseHotkey(editTextHotkey);
      
      const monitor = new GlobalKeyboardMonitor('edit');
      monitor.startMonitoring(
        key,
        modifiers,
        () => {
          if (!this.isRecording && !this.holdModeActive) {
            this.holdModeActive = true;
            this.startRecording('edit');
          }
        },
        () => {
          if (this.isRecording && this.holdModeActive) {
            this.holdModeActive = false;
            this.stopRecording();
          }
        }
      );
      this.keyboardMonitors.set('edit', monitor);
      console.log(`[OpenType] Registered edit text shortcut: ${editTextHotkey}`);
    }
  }

  private parseHotkey(hotkey: string): { key: string; modifiers: string[] } {
    const parts = hotkey.split('+').map(p => p.trim().toUpperCase());
    const key = parts[parts.length - 1];
    const modifiers: string[] = [];
    
    for (const part of parts.slice(0, -1)) {
      if (part === 'COMMANDORCONTROL' || part === 'COMMAND') {
        modifiers.push('LEFT META');
      } else if (part === 'CONTROL') {
        modifiers.push('LEFT CTRL');
      } else if (part === 'SHIFT') {
        modifiers.push('LEFT SHIFT');
      } else if (part === 'ALT' || part === 'OPTION') {
        modifiers.push('LEFT ALT');
      }
    }
    
    return { key, modifiers };
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
        this.transcriptionService?.updateConfig({
          language: langCode
        });
        console.log(`[OpenType] Language updated to: ${langCode}`);
      }
      if (key === 'preferredProvider' && typeof value === 'string') {
        this.transcriptionService?.updateConfig({
          preferredProvider: value as 'local' | 'cloud' | 'auto'
        });
      }
      if (key === 'voiceInputModes') {
        this.updateHotkey(this.store.get('hotkey') || 'CommandOrControl+Shift+D');
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
    ipcMain.handle('providers:get-config', async (_, id: string) => await this.providerManager.getConfig(id));
    ipcMain.handle('providers:set-config', async (_, id: string, config: unknown) => {
      const result = await this.providerManager.setConfig(id, (config || {}) as any);
      this.transcriptionService?.updateConfig({
        cloudProviders: await this.getCloudProviderConfigs()
      });
      return result;
    });
    ipcMain.handle('providers:test', (_, id: string) => this.providerManager.testConnection(id));

    // History
    ipcMain.handle('history:get', (_, limit: number) => this.store.getHistory(limit));
    ipcMain.handle('history:delete', (_, id: string) => this.store.deleteHistoryItem(id));
    ipcMain.handle('history:clear', () => this.store.clearHistory());

    // Data Export
    ipcMain.handle('export:history', (_, format: 'json' | 'csv') => {
      try {
        if (format === 'csv') {
          return { success: true, data: this.store.exportHistoryToCSV() };
        }
        return { success: true, data: JSON.stringify(this.store.exportHistoryToJSON(), null, 2) };
      } catch (error: any) {
        return { success: false, error: error?.message || 'Export failed' };
      }
    });
    ipcMain.handle('export:dictionary', () => {
      try {
        return { success: true, data: JSON.stringify(this.store.exportDictionaryToJSON(), null, 2) };
      } catch (error: any) {
        return { success: false, error: error?.message || 'Export failed' };
      }
    });
    ipcMain.handle('export:settings', () => {
      try {
        return { success: true, data: JSON.stringify(this.store.exportSettingsToJSON(), null, 2) };
      } catch (error: any) {
        return { success: false, error: error?.message || 'Export failed' };
      }
    });
    ipcMain.handle('export:save-file', async (_, data: string, filename: string) => {
      try {
        const result = await dialog.showSaveDialog(this.mainWindow!, {
          defaultPath: filename,
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'CSV Files', extensions: ['csv'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true };
        }
        fs.writeFileSync(result.filePath, data, 'utf-8');
        return { success: true, path: result.filePath };
      } catch (error: any) {
        return { success: false, error: error?.message || 'Save failed' };
      }
    });

    // Data Cleanup
    ipcMain.handle('cleanup:storage-stats', async () => {
      return await this.store.getStorageStats();
    });
    ipcMain.handle('cleanup:clear-temp', async (_, maxAgeHours?: number) => {
      return await this.store.clearTemporaryFiles(maxAgeHours);
    });
    ipcMain.handle('cleanup:clear-all', async (_, resetSettings: boolean) => {
      await this.store.clearAllData(resetSettings);
    });

    // Dictionary
    ipcMain.handle('dictionary:get', () => this.store.getDictionary());
    ipcMain.handle('dictionary:add', (_, word: string, replacement: string, category?: string) =>
      this.store.addDictionaryEntry(word, replacement, category));
    ipcMain.handle('dictionary:remove', (_, word: string) =>
      this.store.removeDictionaryEntry(word));
    ipcMain.handle('dictionary:get-categories', () => this.store.getDictionaryCategories());
    ipcMain.handle('dictionary:add-category', (_, name: string, color: string) =>
      this.store.addDictionaryCategory(name, color));
    ipcMain.handle('dictionary:remove-category', (_, id: string) =>
      this.store.removeDictionaryCategory(id));
    ipcMain.handle('dictionary:import', (_, format: 'json' | 'csv', data: string) => {
      if (format === 'json') return this.store.importDictionaryFromJSON(data);
      return this.store.importDictionaryFromCSV(data);
    });
    ipcMain.handle('dictionary:export', (_, format: 'json' | 'csv') => {
      if (format === 'json') return JSON.stringify(this.store.exportDictionaryToJSON(), null, 2);
      return this.store.exportDictionaryToCSV();
    });

    // Local Models
    ipcMain.handle('models:list', () => {
      return this.transcriptionService?.listLocalModels() || [];
    });
    ipcMain.handle('models:delete', (_, path: string) => {
      return this.transcriptionService?.deleteModel(path) || false;
    });

    // Window control
    ipcMain.handle('window:hide', () => this.mainWindow?.hide());
    ipcMain.handle('window:show', () => this.showWindow());
    
    // Text insertion
    ipcMain.handle('text:insert', async (_, text: string) => {
      return await this.textInserter.insert(text);
    });
    
    // Transcription status
    ipcMain.handle('transcription:status', async () => {
      return this.transcriptionService?.getStatus() || {
        whisperInstalled: false,
        whisperPath: undefined,
        modelAvailable: false,
        modelPath: undefined,
        hasCloudProvider: false,
        activeProvider: undefined,
        recommendations: ['Transcription service not initialized']
      };
    });
    
    // Audio status
    ipcMain.handle('audio:status', async () => {
      return this.audioCapture.getStatus();
    });
    
    // Audio devices
    ipcMain.handle('audio:devices', async () => {
      return this.audioDeviceManager.getDevices();
    });
    ipcMain.handle('audio:get-selected-device', () => {
      return this.audioDeviceManager.getSelectedDevice();
    });
    ipcMain.handle('audio:set-selected-device', (_, device) => {
      return this.audioDeviceManager.selectDevice(device.id);
    });

    // Diagnostics
    ipcMain.handle('diagnostics:run', async () => {
      return this.diagnosticsService.runAllChecks();
    });
    ipcMain.handle('diagnostics:get-last-failure', () => {
      return this.diagnosticsService.getLastFailure();
    });
    ipcMain.handle('diagnostics:request-permission', async (_, permissionType: 'microphone' | 'accessibility' | 'automation') => {
      if (permissionType === 'microphone') {
        const { systemPreferences } = await import('electron');
        return await systemPreferences.askForMediaAccess('microphone');
      }
      // For accessibility and automation, just open settings
      await this.diagnosticsService.openSettings(permissionType);
      return true;
    });
    ipcMain.handle('diagnostics:open-settings', async (_, permissionType: 'microphone' | 'accessibility' | 'automation') => {
      await this.diagnosticsService.openSettings(permissionType);
    });

    // AI Post-Processing
    ipcMain.handle('ai:get-settings', () => this.store.get('aiPostProcessing'));
    ipcMain.handle('ai:set-settings', (_, settings) => {
      this.store.set('aiPostProcessing', { ...this.store.get('aiPostProcessing'), ...settings });
    });
    ipcMain.handle('ai:test', async (_, text: string) => {
      return await this.aiPostProcessor.process(text);
    });

    ipcMain.handle('profile:get-all', async () => {
      return await this.profileManager.getProfiles();
    });
    ipcMain.handle('profile:get-current', () => {
      return this.profileManager.getCurrentProfile();
    });
    ipcMain.handle('profile:save', async (_, profile) => {
      await this.profileManager.saveProfile(profile);
    });
    ipcMain.handle('profile:delete', async (_, profileId: string) => {
      await this.profileManager.deleteProfile(profileId);
    });

    ipcMain.handle('transcription:start-stream', () => {
      if (!this.transcriptionService) return { success: false, error: 'Transcription service not initialized' };
      this.transcriptionStream = new TranscriptionStream(this.transcriptionService, {
        chunkDurationMs: 3000,
        overlapMs: 500
      });
      this.transcriptionStream.on('partial', (chunk) => {
        this.mainWindow?.webContents.send('transcription:partial', chunk);
      });
      this.transcriptionStream.on('final', (chunk) => {
        this.mainWindow?.webContents.send('transcription:final', chunk);
      });
      this.transcriptionStream.start();
      return { success: true };
    });
    ipcMain.handle('transcription:stop-stream', () => {
      if (this.transcriptionStream) {
        this.transcriptionStream.stop();
        this.transcriptionStream = null;
      }
      return { success: true };
    });
  }

  private async toggleRecording(mode: RecordingMode = 'default'): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording(mode);
    }
  }

  private async startRecording(mode: RecordingMode = 'default'): Promise<void> {
    if (this.isRecording) return;

    this.recordingMode = mode;

    if (mode === 'edit') {
      this.selectedTextBeforeRecording = await this.getSelectedText();
      if (!this.selectedTextBeforeRecording) {
        dialog.showErrorBox('Edit Text Mode', 'Please select some text first before using Edit Text mode.');
        return;
      }
    }

    this.isRecording = true;
    this.updateTrayIcon();

    // Update agent communication
    agentCommunication.setRecordingState(true, mode);
    agentCommunication.recordSessionStart(undefined, mode);
    
    // Show recording notification
    new Notification({
      title: 'OpenType',
      body: mode === 'handsfree' ? '🎙️ Recording (Hands-free mode)' : '🎙️ Recording... Release key to stop',
      silent: true,
    }).show();

    this.mainWindow?.webContents.send('recording:started', { mode });

    // Get selected audio device
    const audioDevice = this.store.getAudioInputDevice();
    const result = await this.audioCapture.start(audioDevice?.index);

    if (!result.success || !result.audioPath) {
      this.isRecording = false;
      this.updateTrayIcon();
      
      // Check for microphone permission error
      if (result.error === 'MICROPHONE_PERMISSION_DENIED') {
        dialog.showErrorBox(
          'Microphone Permission Required',
          'OpenType needs microphone permission to record audio.\n\nPlease go to:\nSystem Settings → Privacy & Security → Microphone\n\nEnable permission for OpenType and try again.'
        );
      } else {
        dialog.showErrorBox('Recording Error', result.error || 'Failed to start audio capture');
      }
      return;
    }

    this.currentAudioPath = result.audioPath;

    if (result.isPlaceholder) {
      console.warn('[OpenType] Recording in placeholder mode - ffmpeg not available');
    }

    if (mode === 'handsfree') {
      console.log('[OpenType] Hands-free mode started - recording continuously');
    }
  }

  private async stopRecording(): Promise<void> {
    if (!this.isRecording) return;

    const currentMode = this.recordingMode;
    this.isRecording = false;
    this.updateTrayIcon();

    // Update agent communication
    agentCommunication.setRecordingState(false);

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

    // Show processing notification
    new Notification({
      title: 'OpenType',
      body: '⏳ Processing speech...',
      silent: true,
    }).show();

    // Transcribe the audio
    this.mainWindow?.webContents.send('transcription:started');

    try {
      const transcriptionResult = await this.transcribeAudio(audioPath, currentMode);
      await this.handleTranscriptionResult(audioPath, transcriptionResult, currentMode);
      
      // Show completion notification
      new Notification({
        title: 'OpenType',
        body: '✓ Text inserted',
        silent: true,
      }).show();
    } catch (error: any) {
      console.error('[OpenType] Transcription error:', error);
      await this.handleTranscriptionResult(audioPath, {
        success: false,
        error: error?.message || 'Transcription failed unexpectedly',
        provider: 'none'
      }, currentMode);
    }
  }

  private async transcribeAudio(audioPath: string, mode: RecordingMode = 'default'): Promise<TranscriptionResult> {
    if (!this.transcriptionService) {
      return {
        success: false,
        error: 'Transcription service not initialized',
        provider: 'none',
        text: ''
      };
    }
    const language = mode === 'translate' ? 'zh' : (this.store.get('language')?.split('-')[0] || 'en');
    this.transcriptionService.updateConfig({
      language,
      cloudProviders: await this.getCloudProviderConfigs(),
      useLocalFirst: true
    });

    return this.transcriptionService.transcribe(audioPath);
  }

  private async getSelectedText(): Promise<string> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const appleScript = `
        tell application "System Events"
          keystroke "c" using command down
        end tell
        delay 0.1
        return the clipboard
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      return stdout.trim();
    } catch (error) {
      console.error('[OpenType] Failed to get selected text:', error);
      return '';
    }
  }

  private async handleTranscriptionResult(audioPath: string, result: TranscriptionResult, mode: RecordingMode = 'default'): Promise<void> {
    try {
      const rawText = result.text || '';
      const status = result.success ? 'completed' : 'error';

      let processedText = rawText;
      let aiResult: AiPostProcessingResult | null = null;

      if (result.success && rawText) {
        if (mode === 'translate') {
          // Translation mode — use configured language pair
          const translateSettings = this.store.getAny<{ sourceLang: string; targetLang: string }>('translateSettings') || { sourceLang: 'zh', targetLang: 'en' };
          if (this.aiPostProcessor.isAvailable()) {
            try {
              console.log(`[OpenType] Starting ${translateSettings.sourceLang}→${translateSettings.targetLang} translation...`);
              aiResult = await this.aiPostProcessor.translate(rawText, translateSettings.sourceLang, translateSettings.targetLang);
              if (aiResult.success) {
                processedText = aiResult.processedText;
                console.log(`[OpenType] Translation complete in ${aiResult.latencyMs}ms`);
              }
            } catch (aiError) {
              console.error('[OpenType] Translation error:', aiError);
            }
          }
        } else if (mode === 'edit') {
          // Edit selected text mode - parse voice commands
          const parsed = parseVoiceInput(rawText, mode);
          console.log('[OpenType] Parsed voice input:', parsed.type, parsed.command || parsed.content);

          switch (parsed.type) {
            case 'translate': {
              if (this.aiPostProcessor.isAvailable()) {
                const targetLang = parsed.targetLang || 'en';
                // Source lang is the inverse of target (if target is en, source is zh, etc.)
                const sourceLang = targetLang === 'en' ? 'zh' : targetLang === 'zh' ? 'en' : 'auto';
                try {
                  aiResult = await this.aiPostProcessor.translate(this.selectedTextBeforeRecording, sourceLang, targetLang);
                  if (aiResult.success) {
                    processedText = aiResult.processedText;
                    console.log(`[OpenType] Translation complete in ${aiResult.latencyMs}ms`);
                  }
                } catch (aiError) {
                  console.error('[OpenType] Translation error:', aiError);
                }
              }
              break;
            }
            case 'insert-line': {
              processedText = this.selectedTextBeforeRecording + '\n';
              break;
            }
            case 'delete-sentence': {
              processedText = removeLastSentence(this.selectedTextBeforeRecording);
              break;
            }
            case 'undo': {
              console.warn('[OpenType] Undo command requires history state - not yet implemented');
              // Fall through: treat as content
              processedText = rawText;
              break;
            }
            case 'add-heading': {
              if (this.aiPostProcessor.isAvailable()) {
                try {
                  aiResult = await this.aiPostProcessor.editText(this.selectedTextBeforeRecording, 'add a heading/title to the text');
                  if (aiResult.success) processedText = aiResult.processedText;
                } catch (aiError) {
                  console.error('[OpenType] Add heading error:', aiError);
                }
              }
              break;
            }
            case 'summarize': {
              if (this.aiPostProcessor.isAvailable()) {
                try {
                  aiResult = await this.aiPostProcessor.editText(this.selectedTextBeforeRecording, 'summarize this text');
                  if (aiResult.success) processedText = aiResult.processedText;
                } catch (aiError) {
                  console.error('[OpenType] Summarize error:', aiError);
                }
              }
              break;
            }
            case 'make-formal': {
              if (this.aiPostProcessor.isAvailable()) {
                try {
                  aiResult = await this.aiPostProcessor.editText(this.selectedTextBeforeRecording, 'make the tone more formal and professional');
                  if (aiResult.success) processedText = aiResult.processedText;
                } catch (aiError) {
                  console.error('[OpenType] Make formal error:', aiError);
                }
              }
              break;
            }
            case 'make-casual': {
              if (this.aiPostProcessor.isAvailable()) {
                try {
                  aiResult = await this.aiPostProcessor.editText(this.selectedTextBeforeRecording, 'make the tone more casual and conversational');
                  if (aiResult.success) processedText = aiResult.processedText;
                } catch (aiError) {
                  console.error('[OpenType] Make casual error:', aiError);
                }
              }
              break;
            }
            default: {
              // content type — insert transcribed text as new content after the selected text
              processedText = this.selectedTextBeforeRecording
                ? this.selectedTextBeforeRecording + ' ' + rawText
                : rawText;
              break;
            }
          }
        } else {
          // Default mode with AI post-processing
          const aiSettings = this.store.get('aiPostProcessing');
          console.log('[OpenType] AI Settings:', { enabled: aiSettings?.enabled, available: this.aiPostProcessor.isAvailable() });
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

      // Record session end with word count
      const wordCount = finalText.split(/\s+/).filter(w => w.length > 0).length;
      agentCommunication.recordSessionEnd(wordCount);

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

  private updateHotkey(_newHotkey: string): void {
    this.registerGlobalShortcuts();
  }

  private updateTrayIcon(): void {
    if (!this.tray) return;

    const icons = this.createTrayIcons();
    this.tray.setImage(this.isRecording ? icons.recording : icons.idle);
    this.tray.setToolTip(this.isRecording ? 'OpenType - Recording...' : 'OpenType - Click to dictate');
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
      this.keyboardMonitors.forEach((monitor) => monitor.stopMonitoring());
      this.keyboardMonitors.clear();
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
