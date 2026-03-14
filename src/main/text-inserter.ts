import { clipboard } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * TextInserter - Inserts text at cursor position
 * 
 * macOS implementation:
 * Primary: AppleScript to paste at cursor
 * Fallback: Clipboard copy + paste simulation
 */
export class TextInserter {
  private lastClipboard: string = '';

  async insert(text: string): Promise<boolean> {
    try {
      const outputMode = 'paste'; // Could be configurable: 'paste' | 'copy' | 'type'
      
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

  /**
   * Primary method: AppleScript paste at cursor
   */
  private async insertViaPaste(text: string): Promise<boolean> {
    try {
      // Save current clipboard
      this.lastClipboard = clipboard.readText();
      
      // Set new text to clipboard
      clipboard.writeText(text);
      
      // Use AppleScript to paste at current cursor position
      // This is the macOS-native way that works in most applications
      const appleScript = `
        tell application "System Events"
          keystroke "v" using command down
        end tell
      `;
      
      await execAsync(`osascript -e '${appleScript}'`);
      
      // Small delay then restore clipboard
      await new Promise(resolve => setTimeout(resolve, 100));
      clipboard.writeText(this.lastClipboard);
      
      return true;
    } catch (error) {
      console.error('[TextInserter] AppleScript paste failed:', error);
      // Fallback to simpler method
      return this.insertViaClipboardFallback(text);
    }
  }

  /**
   * Fallback method: Just set clipboard (user pastes manually)
   */
  private async insertViaClipboardFallback(text: string): Promise<boolean> {
    clipboard.writeText(text);
    console.log('[TextInserter] Text copied to clipboard (fallback)');
    return true;
  }

  /**
   * Type text character by character (slow but works everywhere)
   */
  private async insertViaTyping(text: string): Promise<boolean> {
    try {
      // Escape special characters for AppleScript
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
