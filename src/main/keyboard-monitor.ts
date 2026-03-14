import { GlobalKeyboardListener } from 'node-global-key-listener';

export class GlobalKeyboardMonitor {
  private listener: GlobalKeyboardListener;
  private isKeyDown: boolean = false;
  private targetKey: string = '';
  private keyDownCallback: (() => void) | null = null;
  private keyUpCallback: (() => void) | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.listener = new GlobalKeyboardListener();
  }

  startMonitoring(
    key: string,
    modifiers: string[],
    onKeyDown: () => void,
    onKeyUp: () => void
  ): void {
    if (this.isRunning) {
      this.stopMonitoring();
    }

    this.targetKey = key.toUpperCase();
    this.keyDownCallback = onKeyDown;
    this.keyUpCallback = onKeyUp;

    this.listener.addListener((e, down) => {
      const downMap = down as Record<string, boolean>;
      const isTargetKeyDown = downMap[this.targetKey] === true;
      const modifiersPressed = modifiers.every(mod => downMap[mod] === true);

      if (isTargetKeyDown && modifiersPressed) {
        if (!this.isKeyDown) {
          this.isKeyDown = true;
          this.keyDownCallback?.();
        }
      } else {
        if (this.isKeyDown) {
          this.isKeyDown = false;
          this.keyUpCallback?.();
        }
      }

      return false;
    });

    this.isRunning = true;
    console.log(`[GlobalKeyboardMonitor] Started monitoring: ${modifiers.join('+')}+${key}`);
  }

  stopMonitoring(): void {
    if (!this.isRunning) return;
    
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
