import { uIOhook, UiohookKey } from 'uiohook-napi';
import { systemPreferences } from 'electron';

interface ShortcutConfig {
  id: string;
  targetKey: number;
  requiresCtrl: boolean;
  requiresShift: boolean;
  requiresAlt: boolean;
  requiresMeta: boolean;
  onKeyDown: (() => void) | null;
  onKeyUp: (() => void) | null;
  isKeyDown: boolean;
}

// Global uIOhook manager - singleton to handle multiple shortcuts
class UiohookManager {
  private static instance: UiohookManager;
  private shortcuts: Map<string, ShortcutConfig> = new Map();
  private isRunning: boolean = false;
  private initialized: boolean = false;

  static getInstance(): UiohookManager {
    if (!UiohookManager.instance) {
      UiohookManager.instance = new UiohookManager();
    }
    return UiohookManager.instance;
  }

  private constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    if (this.initialized) return;

    uIOhook.on('keydown', (e) => {
      if (!this.isRunning) return;

      // Debug logging for key events
      if (process.env.DEBUG_KEYS) {
        console.log(`[uIOhook] keydown: keycode=${e.keycode}, ctrl=${e.ctrlKey}, shift=${e.shiftKey}, alt=${e.altKey}, meta=${e.metaKey}`);
      }

      this.shortcuts.forEach((shortcut) => {
        if (e.keycode === shortcut.targetKey && !shortcut.isKeyDown) {
          const modifiersMatch =
            (!shortcut.requiresCtrl || e.ctrlKey) &&
            (!shortcut.requiresShift || e.shiftKey) &&
            (!shortcut.requiresAlt || e.altKey) &&
            (!shortcut.requiresMeta || e.metaKey);

          if (modifiersMatch) {
            console.log(`[uIOhook] Triggering ${shortcut.id} keydown`);
            shortcut.isKeyDown = true;
            shortcut.onKeyDown?.();
          }
        }
      });
    });

    uIOhook.on('keyup', (e) => {
      if (!this.isRunning) return;
      
      this.shortcuts.forEach((shortcut) => {
        if (e.keycode === shortcut.targetKey && shortcut.isKeyDown) {
          shortcut.isKeyDown = false;
          shortcut.onKeyUp?.();
        }
      });
    });

    this.initialized = true;
  }

  registerShortcut(
    id: string,
    key: string,
    modifiers: string[],
    onKeyDown: () => void,
    onKeyUp: () => void
  ): void {
    const keyName = key.toUpperCase() as keyof typeof UiohookKey;
    const targetKey = (UiohookKey[keyName] as number) || 0;

    console.log(`[UiohookManager] Registering shortcut ${id}: ${modifiers.join('+')}+${key} (keycode: ${targetKey})`);

    this.shortcuts.set(id, {
      id,
      targetKey,
      requiresCtrl: modifiers.some(m => m.includes('CTRL')),
      requiresShift: modifiers.some(m => m.includes('SHIFT')),
      requiresAlt: modifiers.some(m => m.includes('ALT') || m.includes('OPTION')),
      requiresMeta: modifiers.some(m => m.includes('META') || m.includes('COMMAND')),
      onKeyDown,
      onKeyUp,
      isKeyDown: false,
    });

    this.startIfNeeded();
  }

  unregisterShortcut(id: string): void {
    console.log(`[UiohookManager] Unregistering shortcut ${id}`);
    this.shortcuts.delete(id);
    
    if (this.shortcuts.size === 0) {
      this.stop();
    }
  }

  private startIfNeeded(): void {
    if (this.isRunning) return;

    if (process.platform === 'darwin') {
      const hasPermission = systemPreferences.isTrustedAccessibilityClient(true);
      if (!hasPermission) {
        console.warn('[UiohookManager] Accessibility permission not granted. Keyboard shortcuts will not work.');
        console.warn('[UiohookManager] Please grant accessibility permission in System Settings > Privacy & Security > Accessibility');
        return;
      }
    }

    try {
      uIOhook.start();
      this.isRunning = true;
      console.log('[UiohookManager] Started uIOhook');
    } catch (error) {
      console.error('[UiohookManager] Failed to start uIOhook:', error);
    }
  }

  stop(): void {
    if (!this.isRunning) return;
    
    try {
      uIOhook.stop();
      this.isRunning = false;
      // Reset all key states
      this.shortcuts.forEach(shortcut => {
        shortcut.isKeyDown = false;
      });
      console.log('[UiohookManager] Stopped uIOhook');
    } catch (error) {
      console.error('[UiohookManager] Error stopping uIOhook:', error);
    }
  }

  stopAll(): void {
    this.shortcuts.clear();
    this.stop();
  }
}

// Wrapper class for backward compatibility and per-shortcut management
export class GlobalKeyboardMonitor {
  private id: string;
  private static counter = 0;
  private manager: UiohookManager;
  private isActive: boolean = false;

  constructor(id?: string) {
    this.id = id || `monitor-${++GlobalKeyboardMonitor.counter}`;
    this.manager = UiohookManager.getInstance();
  }

  startMonitoring(
    key: string,
    modifiers: string[],
    onKeyDown: () => void,
    onKeyUp: () => void
  ): void {
    if (this.isActive) {
      this.stopMonitoring();
    }

    this.manager.registerShortcut(this.id, key, modifiers, onKeyDown, onKeyUp);
    this.isActive = true;
  }

  stopMonitoring(): void {
    if (!this.isActive) return;
    
    this.manager.unregisterShortcut(this.id);
    this.isActive = false;
  }

  isMonitoring(): boolean {
    return this.isActive;
  }

  // Static method to stop all monitoring
  static stopAll(): void {
    UiohookManager.getInstance().stopAll();
  }
}
