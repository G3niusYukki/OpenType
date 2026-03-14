import { clipboard } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

type OutputMode = 'paste' | 'copy' | 'type';

/**
 * TextInserter - Inserts text at cursor position
 *
 * macOS implementation:
 * Primary: AppleScript to paste at cursor
 * Fallback: Clipboard copy + paste simulation
 */
export class TextInserter {
  private lastClipboard = '';

  async insert(text: string, outputMode: OutputMode = 'paste'): Promise<boolean> {
    try {
      switch (outputMode) {
        case 'paste':
          return await this.insertViaPaste(text);
        case 'copy':
          clipboard.writeText(text);
          return true;
        case 'type':
          return await this.insertViaTyping(text);
        default:
          return await this.insertViaPaste(text);
      }
    } catch (error) {
      console.error('[TextInserter] Failed to insert text:', error);
      return false;
    }
  }

  private async insertViaPaste(text: string): Promise<boolean> {
    try {
      this.lastClipboard = clipboard.readText();
      clipboard.writeText(text);

      const appleScript = `
        tell application "System Events"
          keystroke "v" using command down
        end tell
      `;

      await execAsync(`osascript -e '${appleScript}'`);
      await new Promise(resolve => setTimeout(resolve, 100));
      clipboard.writeText(this.lastClipboard);

      return true;
    } catch (error) {
      console.error('[TextInserter] AppleScript paste failed:', error);
      return this.insertViaClipboardFallback(text);
    }
  }

  private async insertViaClipboardFallback(text: string): Promise<boolean> {
    clipboard.writeText(text);
    console.log('[TextInserter] Text copied to clipboard (fallback)');
    return true;
  }

  private async insertViaTyping(text: string): Promise<boolean> {
    try {
      const escaped = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');

      const appleScript = `
        tell application "System Events"
          keystroke "${escaped}"
        end tell
      `;

      await execAsync(`osascript -e '${appleScript}'`);
      return true;
    } catch (error) {
      console.error('[TextInserter] Typing method failed:', error);
      return false;
    }
  }
}
