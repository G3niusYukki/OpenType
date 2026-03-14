import { clipboard } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface InsertionResult {
  success: boolean;
  method: 'paste' | 'clipboard' | 'type' | 'failed';
  error?: string;
  text: string;
  accessibilityRequired?: boolean;
}

/**
 * TextInserter - Inserts text at cursor position
 *
 * macOS implementation:
 * Primary: AppleScript to paste at cursor
 * Fallback: Clipboard copy
 */
export class TextInserter {
  private lastClipboard = '';

  async insert(text: string, outputMode: 'paste' | 'copy' | 'type' = 'paste'): Promise<InsertionResult> {
    try {
      switch (outputMode) {
        case 'paste':
          return await this.insertViaPaste(text);
        case 'copy':
          clipboard.writeText(text);
          return { success: true, method: 'clipboard', text };
        case 'type':
          return await this.insertViaTyping(text);
        default:
          return await this.insertViaPaste(text);
      }
    } catch (error) {
      console.error('[TextInserter] Failed to insert text:', error);
      // Always fall back to clipboard
      clipboard.writeText(text);
      return {
        success: true,
        method: 'clipboard',
        text,
        error: error instanceof Error ? error.message : 'Insertion failed, copied to clipboard instead'
      };
    }
  }

  private async insertViaPaste(text: string): Promise<InsertionResult> {
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

      return { success: true, method: 'paste', text };
    } catch (error) {
      console.error('[TextInserter] AppleScript paste failed:', error);
      return this.insertViaClipboardFallback(text, error);
    }
  }

  private async insertViaClipboardFallback(text: string, originalError?: unknown): Promise<InsertionResult> {
    clipboard.writeText(text);
    const errorMsg = originalError instanceof Error ? originalError.message : String(originalError);
    const needsAccessibility = errorMsg.includes('not allowed to send keystrokes') || 
                               errorMsg.includes('accessibility');
    
    console.log('[TextInserter] Text copied to clipboard (fallback)');
    
    return {
      success: true,
      method: 'clipboard',
      text,
      error: 'Copied to clipboard (paste failed)',
      accessibilityRequired: needsAccessibility
    };
  }

  private async insertViaTyping(text: string): Promise<InsertionResult> {
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
      return { success: true, method: 'type', text };
    } catch (error) {
      console.error('[TextInserter] Typing method failed:', error);
      return this.insertViaClipboardFallback(text, error);
    }
  }
}
