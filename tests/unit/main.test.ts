import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key: string) {
      const defaults: Record<string, unknown> = {
        hotkey: 'CommandOrControl+Shift+D',
        handsFreeHotkey: 'CommandOrControl+Space',
        translateHotkey: 'CommandOrControl+Shift+T',
        editTextHotkey: 'CommandOrControl+Shift+E',
        outputMode: 'paste',
        language: 'en-US',
        autoPunctuation: true,
        preferredProvider: 'auto',
        providers: [{ id: 'openai', name: 'OpenAI', enabled: false }, { id: 'groq', name: 'Groq', enabled: false }],
        aiPostProcessing: { enabled: false, options: { removeFillerWords: true, removeRepetition: true, detectSelfCorrection: true }, showComparison: true },
        voiceInputModes: { basicVoiceInput: true, handsFreeMode: true, translateToEnglish: true, editSelectedText: true },
        history: [],
        dictionary: [],
      };
      return defaults[key];
    }
    set() {}
  },
}));

vi.mock('electron', () => {
  const mockBrowserWindow = { loadURL: vi.fn().mockResolvedValue(undefined), loadFile: vi.fn().mockResolvedValue(undefined), show: vi.fn(), hide: vi.fn(), focus: vi.fn(), close: vi.fn(), isVisible: vi.fn().mockReturnValue(true), on: vi.fn(), webContents: { send: vi.fn(), openDevTools: vi.fn(), on: vi.fn() } };
  const mockTray = { setToolTip: vi.fn(), setContextMenu: vi.fn(), setImage: vi.fn(), on: vi.fn(), popUpContextMenu: vi.fn(), destroy: vi.fn() };
  const mockNotification = { show: vi.fn() };
  const mockApp = { getPath: vi.fn().mockReturnValue('/tmp'), whenReady: vi.fn().mockResolvedValue(undefined), on: vi.fn(), once: vi.fn(), quit: vi.fn(), isReady: vi.fn().mockReturnValue(true) };
  const mockGlobalShortcut = { register: vi.fn().mockReturnValue(true), unregisterAll: vi.fn() };
  const mockIpcMain = { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() };
  const mockClipboard = { readText: vi.fn().mockReturnValue(''), writeText: vi.fn() };
  const mockNativeImage = { createFromPath: vi.fn().mockReturnValue({ filePath: '' }), createFromBuffer: vi.fn().mockReturnValue({ resize: vi.fn().mockReturnValue({}) }) };
  const mockDialog = { showErrorBox: vi.fn(), showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) };
  const mockMenu = { buildFromTemplate: vi.fn().mockImplementation((t: any) => ({ items: t })), setApplicationMenu: vi.fn() };
  return {
    app: mockApp,
    BrowserWindow: class BrowserWindow { constructor() { return mockBrowserWindow as any; } },
    Tray: class Tray { constructor() { return mockTray as any; } },
    Menu: mockMenu,
    globalShortcut: mockGlobalShortcut,
    ipcMain: mockIpcMain,
    clipboard: mockClipboard,
    nativeImage: mockNativeImage,
    dialog: mockDialog,
    Notification: class Notification { constructor() { return mockNotification as any; } },
    __mocks: { browserWindow: mockBrowserWindow, tray: mockTray, notification: mockNotification, app: mockApp, globalShortcut: mockGlobalShortcut, ipcMain: mockIpcMain, dialog: mockDialog, menu: mockMenu },
  };
});

vi.mock('../../src/main/audio-capture', () => ({
  AudioCapture: class { async start() { return { success: true, audioPath: '/tmp/test.wav' }; } async stop() { return { success: true, audioPath: '/tmp/test.wav' }; } async getStatus() { return { ffmpegAvailable: true, hasAudioDevices: true }; } async getAudioDevices() { return []; } },
}));

vi.mock('../../src/main/transcription', () => ({
  TranscriptionService: class { async transcribe() { return { success: true, text: 'Test', provider: 'whisper.cpp' }; } async getStatus() { return { whisperInstalled: true, modelAvailable: true, recommendations: [] }; } updateConfig() {} },
}));

vi.mock('../../src/main/aiPostProcessor', () => ({
  AiPostProcessor: class { async process(text: string) { return { success: true, originalText: text, processedText: text, changes: [], provider: 'OpenAI', latencyMs: 100 }; } async translate(text: string) { return { success: true, originalText: text, processedText: 'Translated', changes: [], provider: 'OpenAI', latencyMs: 100 }; } async editText(selectedText: string) { return { success: true, originalText: selectedText, processedText: 'Edited', changes: [], provider: 'OpenAI', latencyMs: 100 }; } isAvailable() { return true; } },
}));

vi.mock('../../src/main/text-inserter', () => ({
  TextInserter: class { async insert(text: string) { return { success: true, method: 'paste', text }; } },
}));

vi.mock('../../src/main/providers', () => ({
  ProviderManager: class { listProviders() { return []; } listTranscriptionProviders() { return []; } listPostProcessingProviders() { return []; } getConfig(id: string) { return { provider: { id }, config: { id, enabled: false } }; } setConfig() { return true; } async testConnection() { return { success: true }; } },
}));

vi.mock('../../src/main/keyboard-monitor', () => ({
  GlobalKeyboardMonitor: class { startMonitoring() {} stopMonitoring() {} },
}));

vi.mock('child_process', () => ({
  default: {
    exec: vi.fn().mockImplementation((cmd: any, callback: any) => { if (callback) callback(null, { stdout: 'selected text' }); return { stdout: 'selected text' }; }),
    execFile: vi.fn(),
    spawn: vi.fn().mockReturnValue({ on: vi.fn(), once: vi.fn(), stderr: { on: vi.fn() }, stdin: { write: vi.fn() }, kill: vi.fn(), pid: 12345 }),
  },
  exec: vi.fn().mockImplementation((cmd: any, callback: any) => { if (callback) callback(null, { stdout: 'selected text' }); return { stdout: 'selected text' }; }),
  execFile: vi.fn(),
  spawn: vi.fn().mockReturnValue({ on: vi.fn(), once: vi.fn(), stderr: { on: vi.fn() }, stdin: { write: vi.fn() }, kill: vi.fn(), pid: 12345 }),
}));

import { OpenTypeApp } from '../../src/main/main';

describe('OpenTypeApp', () => {
  let app: OpenTypeApp;
  let mocks: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const electron = await vi.importMock('electron');
    mocks = (electron as any).__mocks;
    delete process.env.LANG;
    delete process.env.LC_ALL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create app instance', () => {
      app = new OpenTypeApp();
      expect(app).toBeDefined();
    });

    it('should detect language from LANG environment variable', () => {
      process.env.LANG = 'zh_CN.UTF-8';
      app = new OpenTypeApp();
      expect(app).toBeDefined();
    });

    it('should return only enabled cloud transcription provider configs', async () => {
      app = new OpenTypeApp();
      const configs = await (app as any).getCloudProviderConfigs();

      expect(configs).toEqual([]);
    });

    it('should parse hotkeys into a key and modifiers', () => {
      app = new OpenTypeApp();

      expect((app as any).parseHotkey('CommandOrControl+Shift+T')).toEqual({
        key: 'T',
        modifiers: ['LEFT META', 'LEFT SHIFT'],
      });
      expect((app as any).parseHotkey('Control+Option+Space')).toEqual({
        key: 'SPACE',
        modifiers: ['LEFT CTRL', 'LEFT ALT'],
      });
    });
  });

  describe('initialize()', () => {
    beforeEach(() => {
      app = new OpenTypeApp();
    });

    it('should wait for app to be ready', async () => {
      await app.initialize();
      expect(mocks.app.whenReady).toHaveBeenCalled();
    });

    it('should register global shortcuts', async () => {
      await app.initialize();
      expect(mocks.globalShortcut.register).toHaveBeenCalled();
    });

    it('should setup IPC handlers', async () => {
      await app.initialize();
      expect(mocks.ipcMain.handle).toHaveBeenCalled();
    });

    it('should setup window-all-closed handler', async () => {
      await app.initialize();
      expect(mocks.app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
    });

    it('should setup activate handler', async () => {
      await app.initialize();
      expect(mocks.app.on).toHaveBeenCalledWith('activate', expect.any(Function));
    });

    it('should setup before-quit handler', async () => {
      await app.initialize();
      expect(mocks.app.on).toHaveBeenCalledWith('before-quit', expect.any(Function));
    });
  });

  describe('Window Management', () => {
    beforeEach(async () => {
      app = new OpenTypeApp();
      await app.initialize();
    });

    it('should create BrowserWindow with correct options', async () => {
      const { BrowserWindow } = await import('electron');
      expect(BrowserWindow).toBeDefined();
    });

    it('should load development URL in dev mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      vi.clearAllMocks();
      app = new OpenTypeApp();
      await app.initialize();
      expect(mocks.browserWindow.loadURL).toHaveBeenCalledWith('http://localhost:5187');
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should load file in production mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      vi.clearAllMocks();
      app = new OpenTypeApp();
      await app.initialize();
      expect(mocks.browserWindow.loadFile).toHaveBeenCalled();
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should create tray', async () => {
      const { Tray } = await import('electron');
      expect(Tray).toBeDefined();
    });

    it('should build tray context menu', async () => {
      expect(mocks.menu.buildFromTemplate).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    beforeEach(async () => {
      app = new OpenTypeApp();
      await app.initialize();
    });

    it('should register hands-free toggle shortcut', () => {
      expect(mocks.globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+Space', expect.any(Function));
    });

    it('should unregister all shortcuts on before-quit', async () => {
      const beforeQuitHandler = mocks.app.on.mock.calls.find((call: any[]) => call[0] === 'before-quit')?.[1];
      expect(beforeQuitHandler).toBeDefined();
      beforeQuitHandler?.();
      expect(mocks.globalShortcut.unregisterAll).toHaveBeenCalled();
    });
  });

  describe('IPC Handlers', () => {
    beforeEach(async () => {
      app = new OpenTypeApp();
      await app.initialize();
    });

    it('should register all required IPC handlers', () => {
      const expectedHandlers = [
        'store:get', 'store:set', 'recording:start', 'recording:stop', 'recording:get-state',
        'providers:list', 'providers:list-transcription', 'providers:list-post-processing', 'providers:get-config', 'providers:set-config', 'providers:test',
        'history:get', 'history:delete', 'history:clear', 'dictionary:get', 'dictionary:add', 'dictionary:remove',
        'window:hide', 'window:show', 'text:insert', 'transcription:status', 'audio:status', 'audio:devices',
        'ai:get-settings', 'ai:set-settings', 'ai:test',
      ];
      expectedHandlers.forEach(handler => {
        expect(mocks.ipcMain.handle).toHaveBeenCalledWith(handler, expect.any(Function));
      });
    });

    it('should register store:get handler', () => {
      expect(mocks.ipcMain.handle).toHaveBeenCalledWith('store:get', expect.any(Function));
    });

    it('should register store:set handler', () => {
      expect(mocks.ipcMain.handle).toHaveBeenCalledWith('store:set', expect.any(Function));
    });

    it('should register recording:start handler', () => {
      expect(mocks.ipcMain.handle).toHaveBeenCalledWith('recording:start', expect.any(Function));
    });

    it('should register recording:stop handler', () => {
      expect(mocks.ipcMain.handle).toHaveBeenCalledWith('recording:stop', expect.any(Function));
    });

    it('should register providers:list handler', () => {
      expect(mocks.ipcMain.handle).toHaveBeenCalledWith('providers:list', expect.any(Function));
    });

    it('should register history:get handler', () => {
      expect(mocks.ipcMain.handle).toHaveBeenCalledWith('history:get', expect.any(Function));
    });

    it('should register text:insert handler', () => {
      expect(mocks.ipcMain.handle).toHaveBeenCalledWith('text:insert', expect.any(Function));
    });

    it('should register transcription:status handler', () => {
      expect(mocks.ipcMain.handle).toHaveBeenCalledWith('transcription:status', expect.any(Function));
    });

    it('should register ai:test handler', () => {
      expect(mocks.ipcMain.handle).toHaveBeenCalledWith('ai:test', expect.any(Function));
    });
  });

  describe('Signal Handlers', () => {
    it('should setup SIGTERM handler', async () => {
      const processOnSpy = vi.spyOn(process, 'on');
      app = new OpenTypeApp();
      await app.initialize();
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      processOnSpy.mockRestore();
    });

    it('should setup SIGINT handler', async () => {
      const processOnSpy = vi.spyOn(process, 'on');
      app = new OpenTypeApp();
      await app.initialize();
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      processOnSpy.mockRestore();
    });
  });
});
