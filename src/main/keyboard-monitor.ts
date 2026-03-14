import { uIOhook, UiohookKey } from 'uiohook-napi';

export class GlobalKeyboardMonitor {
  private isKeyDown: boolean = false;
  private targetKey: number = 0;
  private keyDownCallback: (() => void) | null = null;
  private keyUpCallback: (() => void) | null = null;
  private isRunning: boolean = false;
  private requiresCtrl: boolean = false;
  private requiresShift: boolean = false;
  private requiresAlt: boolean = false;
  private requiresMeta: boolean = false;

  constructor() {}

  startMonitoring(
    key: string,
    modifiers: string[],
    onKeyDown: () => void,
    onKeyUp: () => void
  ): void {
    if (this.isRunning) {
      this.stopMonitoring();
    }

    this.targetKey = (UiohookKey as any)[key.toUpperCase()] || 0;
    this.keyDownCallback = onKeyDown;
    this.keyUpCallback = onKeyUp;

    this.requiresCtrl = modifiers.some(m => m.includes('CTRL'));
    this.requiresShift = modifiers.some(m => m.includes('SHIFT'));
    this.requiresAlt = modifiers.some(m => m.includes('ALT') || m.includes('OPTION'));
    this.requiresMeta = modifiers.some(m => m.includes('META') || m.includes('COMMAND'));

    uIOhook.on('keydown', (e) => {
      if (!this.isRunning) return;
      
      if (e.keycode === this.targetKey && !this.isKeyDown) {
        const modifiersMatch = 
          (!this.requiresCtrl || e.ctrlKey) &&
          (!this.requiresShift || e.shiftKey) &&
          (!this.requiresAlt || e.altKey) &&
          (!this.requiresMeta || e.metaKey);

        if (modifiersMatch) {
          this.isKeyDown = true;
          this.keyDownCallback?.();
        }
      }
    });

    uIOhook.on('keyup', (e) => {
      if (!this.isRunning) return;
      
      if (e.keycode === this.targetKey && this.isKeyDown) {
        this.isKeyDown = false;
        this.keyUpCallback?.();
      }
    });

    uIOhook.start();
    this.isRunning = true;
    console.log('[GlobalKeyboardMonitor] Started monitoring: ' + modifiers.join('+') + '+' + key);
  }

  stopMonitoring(): void {
    if (!this.isRunning) return;
    
    uIOhook.stop();
    this.isRunning = false;
    this.isKeyDown = false;
    console.log('[GlobalKeyboardMonitor] Stopped monitoring');
  }

  isMonitoring(): boolean {
    return this.isRunning;
  }

  isPressed(): boolean {
    return this.isKeyDown;
  }
}
