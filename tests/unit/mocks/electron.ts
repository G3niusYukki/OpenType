import { vi } from 'vitest';

type MockFn<T extends (...args: any[]) => any> = ReturnType<typeof vi.fn<T>>;
type Listener = (...args: unknown[]) => void;

export interface ElectronAppMock {
  getPath: MockFn<(name: string) => string>;
  whenReady: MockFn<() => Promise<void>>;
  on: MockFn<(event: string, listener: Listener) => void>;
  once: MockFn<(event: string, listener: Listener) => void>;
  quit: MockFn<() => void>;
  isReady: MockFn<() => boolean>;
}

export interface ElectronBrowserWindowMock {
  loadURL: MockFn<(url: string) => Promise<void>>;
  loadFile: MockFn<(filePath: string) => Promise<void>>;
  show: MockFn<() => void>;
  hide: MockFn<() => void>;
  close: MockFn<() => void>;
  focus: MockFn<() => void>;
  isVisible: MockFn<() => boolean>;
  on: MockFn<(event: string, listener: Listener) => void>;
  webContents: {
    send: MockFn<(channel: string, ...args: unknown[]) => void>;
    openDevTools: MockFn<() => void>;
  };
}

export interface ElectronTrayMock {
  setToolTip: MockFn<(tooltip: string) => void>;
  setContextMenu: MockFn<(menu: unknown) => void>;
  setImage: MockFn<(image: unknown) => void>;
  on: MockFn<(event: string, listener: Listener) => void>;
  popUpContextMenu: MockFn<(menu?: unknown) => void>;
  destroy: MockFn<() => void>;
}

export interface ElectronModuleMock {
  app: ElectronAppMock;
  BrowserWindow: MockFn<(options?: unknown) => ElectronBrowserWindowMock>;
  Tray: MockFn<(image?: unknown) => ElectronTrayMock>;
  Menu: {
    buildFromTemplate: MockFn<(template: unknown[]) => { items: unknown[] }>;
    setApplicationMenu: MockFn<(menu: unknown) => void>;
  };
  globalShortcut: {
    register: MockFn<(accelerator: string, callback: () => void) => boolean>;
    unregisterAll: MockFn<() => void>;
  };
  ipcMain: {
    handle: MockFn<(channel: string, handler: Listener) => void>;
    on: MockFn<(channel: string, listener: Listener) => void>;
    removeHandler: MockFn<(channel: string) => void>;
  };
  clipboard: {
    readText: MockFn<() => string>;
    writeText: MockFn<(text: string) => void>;
  };
  nativeImage: {
    createFromPath: MockFn<(filePath: string) => { filePath: string }>;
  };
  dialog: {
    showMessageBox: MockFn<(browserWindow: unknown, options: unknown) => Promise<{ response: number }>>;
  };
  Notification: MockFn<(options?: unknown) => { show: MockFn<() => void> }>;
  systemPreferences: {
    isTrustedAccessibilityClient: MockFn<(prompt: boolean) => boolean>;
  };
}

export interface ElectronMockHelpers {
  module: ElectronModuleMock & { default: ElectronModuleMock };
  browserWindow: ElectronBrowserWindowMock;
  tray: ElectronTrayMock;
  notification: { show: MockFn<() => void> };
  resetElectronMocks: () => void;
}

/**
 * Creates a reusable Electron module mock payload.
 *
 * @example
 * ```ts
 * import { beforeEach, expect, it, vi } from 'vitest';
 * import { createElectronMocks } from './mocks';
 *
 * const electronMocks = createElectronMocks();
 * vi.mock('electron', () => electronMocks.module);
 *
 * beforeEach(() => {
 *   electronMocks.resetElectronMocks();
 * });
 *
 * it('stubs clipboard access', () => {
 *   electronMocks.module.clipboard.readText.mockReturnValue('copied');
 *   expect(electronMocks.module.clipboard.readText()).toBe('copied');
 * });
 * ```
 */
export const createElectronMocks = (): ElectronMockHelpers => {
  const browserWindow: ElectronBrowserWindowMock = {
    loadURL: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(),
    loadFile: vi.fn<(filePath: string) => Promise<void>>().mockResolvedValue(),
    show: vi.fn<() => void>(),
    hide: vi.fn<() => void>(),
    close: vi.fn<() => void>(),
    focus: vi.fn<() => void>(),
    isVisible: vi.fn<() => boolean>().mockReturnValue(true),
    on: vi.fn<(event: string, listener: Listener) => void>(),
    webContents: {
      send: vi.fn<(channel: string, ...args: unknown[]) => void>(),
      openDevTools: vi.fn<() => void>(),
    },
  };

  const tray: ElectronTrayMock = {
    setToolTip: vi.fn<(tooltip: string) => void>(),
    setContextMenu: vi.fn<(menu: unknown) => void>(),
    setImage: vi.fn<(image: unknown) => void>(),
    on: vi.fn<(event: string, listener: Listener) => void>(),
    popUpContextMenu: vi.fn<(menu?: unknown) => void>(),
    destroy: vi.fn<() => void>(),
  };

  const notification = {
    show: vi.fn<() => void>(),
  };

  const baseModule: ElectronModuleMock = {
    app: {
      getPath: vi.fn<(name: string) => string>().mockReturnValue('/tmp'),
      whenReady: vi.fn<() => Promise<void>>().mockResolvedValue(),
      on: vi.fn<(event: string, listener: Listener) => void>(),
      once: vi.fn<(event: string, listener: Listener) => void>(),
      quit: vi.fn<() => void>(),
      isReady: vi.fn<() => boolean>().mockReturnValue(true),
    },
    BrowserWindow: vi.fn<(options?: unknown) => ElectronBrowserWindowMock>(() => browserWindow),
    Tray: vi.fn<(image?: unknown) => ElectronTrayMock>(() => tray),
    Menu: {
      buildFromTemplate: vi.fn<(template: unknown[]) => { items: unknown[] }>((template) => ({ items: template })),
      setApplicationMenu: vi.fn<(menu: unknown) => void>(),
    },
    globalShortcut: {
      register: vi.fn<(accelerator: string, callback: () => void) => boolean>().mockReturnValue(true),
      unregisterAll: vi.fn<() => void>(),
    },
    ipcMain: {
      handle: vi.fn<(channel: string, handler: Listener) => void>(),
      on: vi.fn<(channel: string, listener: Listener) => void>(),
      removeHandler: vi.fn<(channel: string) => void>(),
    },
    clipboard: {
      readText: vi.fn<() => string>().mockReturnValue(''),
      writeText: vi.fn<(text: string) => void>(),
    },
    nativeImage: {
      createFromPath: vi.fn<(filePath: string) => { filePath: string }>((filePath) => ({ filePath })),
    },
    dialog: {
      showMessageBox: vi.fn<(browserWindow: unknown, options: unknown) => Promise<{ response: number }>>().mockResolvedValue({ response: 0 }),
    },
    Notification: vi.fn<(options?: unknown) => { show: MockFn<() => void> }>(() => notification),
    systemPreferences: {
      isTrustedAccessibilityClient: vi.fn<(prompt: boolean) => boolean>().mockReturnValue(true),
    },
  };

  const module = Object.assign(baseModule, {
    default: baseModule,
  }) as ElectronModuleMock & { default: ElectronModuleMock };

  const resetElectronMocks = (): void => {
    module.app.getPath.mockReset();
    module.app.getPath.mockReturnValue('/tmp');
    module.app.whenReady.mockReset();
    module.app.whenReady.mockResolvedValue();
    module.app.on.mockReset();
    module.app.once.mockReset();
    module.app.quit.mockReset();
    module.app.isReady.mockReset();
    module.app.isReady.mockReturnValue(true);

    browserWindow.loadURL.mockReset();
    browserWindow.loadURL.mockResolvedValue();
    browserWindow.loadFile.mockReset();
    browserWindow.loadFile.mockResolvedValue();
    browserWindow.show.mockReset();
    browserWindow.hide.mockReset();
    browserWindow.close.mockReset();
    browserWindow.focus.mockReset();
    browserWindow.isVisible.mockReset();
    browserWindow.isVisible.mockReturnValue(true);
    browserWindow.on.mockReset();
    browserWindow.webContents.send.mockReset();
    browserWindow.webContents.openDevTools.mockReset();

    tray.setToolTip.mockReset();
    tray.setContextMenu.mockReset();
    tray.setImage.mockReset();
    tray.on.mockReset();
    tray.popUpContextMenu.mockReset();
    tray.destroy.mockReset();

    module.BrowserWindow.mockClear();
    module.Tray.mockClear();
    module.Menu.buildFromTemplate.mockReset();
    module.Menu.buildFromTemplate.mockImplementation((template) => ({ items: template }));
    module.Menu.setApplicationMenu.mockReset();
    module.globalShortcut.register.mockReset();
    module.globalShortcut.register.mockReturnValue(true);
    module.globalShortcut.unregisterAll.mockReset();
    module.ipcMain.handle.mockReset();
    module.ipcMain.on.mockReset();
    module.ipcMain.removeHandler.mockReset();
    module.clipboard.readText.mockReset();
    module.clipboard.readText.mockReturnValue('');
    module.clipboard.writeText.mockReset();
    module.nativeImage.createFromPath.mockReset();
    module.nativeImage.createFromPath.mockImplementation((filePath) => ({ filePath }));
    module.dialog.showMessageBox.mockReset();
    module.dialog.showMessageBox.mockResolvedValue({ response: 0 });
    module.Notification.mockClear();
    module.systemPreferences.isTrustedAccessibilityClient.mockReset();
    module.systemPreferences.isTrustedAccessibilityClient.mockReturnValue(true);
    notification.show.mockReset();
  };

  return {
    module,
    browserWindow,
    tray,
    notification,
    resetElectronMocks,
  };
};
