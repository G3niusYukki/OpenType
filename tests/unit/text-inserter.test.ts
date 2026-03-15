import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextInserter } from '../../src/main/text-inserter';
import { clipboard } from 'electron';
import { exec } from 'child_process';

const mockExec = vi.hoisted(() => vi.fn());
const mockPromisify = vi.hoisted(() =>
  vi.fn((fn: (...args: any[]) => unknown) => (...args: any[]) =>
    new Promise((resolve, reject) => {
      const callback = (error: Error | null, stdout: string | null, stderr: string | null) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({ stdout, stderr });
      };

      fn(...args, callback);
    })
  )
);

// Mock electron clipboard
vi.mock('electron', () => ({
  clipboard: {
    readText: vi.fn(),
    writeText: vi.fn(),
  },
}));

// Mock child_process exec
vi.mock('child_process', () => ({
  exec: mockExec,
  default: {
    exec: mockExec,
  },
}));

vi.mock('util', () => ({
  promisify: mockPromisify,
  default: {
    promisify: mockPromisify,
  },
}));

describe('TextInserter', () => {
  let inserter: TextInserter;

  beforeEach(() => {
    vi.clearAllMocks();
    inserter = new TextInserter();
  });

  describe('insert with copy mode', () => {
    it('should copy text to clipboard and return success', async () => {
      const text = 'Hello world';
      
      const result = await inserter.insert(text, 'copy');
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard');
      expect(result.text).toBe(text);
      expect(clipboard.writeText).toHaveBeenCalledWith(text);
    });

    it('should fall back to clipboard result when copy mode throws', async () => {
      const text = 'Copy fallback';

      vi.mocked(clipboard.writeText)
        .mockImplementationOnce(() => {
          throw new Error('Clipboard unavailable');
        })
        .mockImplementation(() => undefined);

      const result = await inserter.insert(text, 'copy');

      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard');
      expect(result.error).toBe('Clipboard unavailable');
      expect(clipboard.writeText).toHaveBeenCalledTimes(2);
      expect(clipboard.writeText).toHaveBeenLastCalledWith(text);
    });
  });

  describe('insert with paste mode', () => {
    it('should fallback to clipboard when AppleScript fails', async () => {
      const text = 'Hello world';
      vi.mocked(clipboard.readText).mockReturnValue('previous clipboard');
      
      vi.mocked(exec).mockImplementation((command: string, callback: any) => {
        const error = new Error('Not allowed to send keystrokes');
        callback(error, '', '');
        return {} as any;
      });

      const result = await inserter.insert(text, 'paste');

      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard');
      expect(clipboard.writeText).toHaveBeenCalledWith(text);
    });

    it('should detect accessibility permission errors', async () => {
      const text = 'Test text';
      vi.mocked(clipboard.readText).mockReturnValue('');
      
      // Simulate accessibility error
      vi.mocked(exec).mockImplementation((command: string, callback: any) => {
        callback(new Error('System Events got an error: accessibility'), null, null);
        return {} as any;
      });

      const result = await inserter.insert(text, 'paste');

      expect(result.accessibilityRequired).toBe(true);
      expect(result.method).toBe('clipboard');
    });

    it('should restore original clipboard after paste', async () => {
      const text = 'New text';
      const originalClipboard = 'original content';
      vi.mocked(clipboard.readText).mockReturnValue(originalClipboard);
      
      // Mock successful exec
      vi.mocked(exec).mockImplementation((command: string, callback: any) => {
        callback(null, 'ok', '');
        return {} as any;
      });

      await inserter.insert(text, 'paste');

      // Should restore original clipboard
      expect(clipboard.writeText).toHaveBeenLastCalledWith(originalClipboard);
    });
  });

  describe('insert with type mode', () => {
    it('should type text successfully when AppleScript succeeds', async () => {
      const text = 'Hello "OpenType"\\nLine 2';

      vi.mocked(exec).mockImplementation((command: string, callback: any) => {
        callback(null, 'ok', '');
        return {} as any;
      });

      const result = await inserter.insert(text, 'type');

      expect(result.success).toBe(true);
      expect(result.method).toBe('type');
      expect(result.text).toBe(text);
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('keystroke "Hello \\\"OpenType\\\"\\\\nLine 2"'),
        expect.any(Function)
      );
    });

    it('should fallback to paste behavior for unknown output mode', async () => {
      const text = 'Unknown mode text';
      vi.mocked(clipboard.readText).mockReturnValue('original');
      vi.mocked(exec).mockImplementation((command: string, callback: any) => {
        callback(null, 'ok', '');
        return {} as any;
      });

      const result = await inserter.insert(text, 'unknown' as any);

      expect(result.success).toBe(true);
      expect(result.method).toBe('paste');
      expect(clipboard.writeText).toHaveBeenLastCalledWith('original');
    });

    it('should fallback to clipboard when typing fails', async () => {
      const text = 'Hello';
      
      vi.mocked(exec).mockImplementation((command: string, callback: any) => {
        callback(new Error('Typing failed'), null, null);
        return {} as any;
      });

      const result = await inserter.insert(text, 'type');

      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard');
      expect(clipboard.writeText).toHaveBeenCalledWith(text);
    });
  });

  describe('error handling', () => {
    it('should always fallback to clipboard on any error', async () => {
      const text = 'Important text';
      
      // Make clipboard throw an error then recover
      vi.mocked(clipboard.writeText).mockImplementationOnce(() => {
        throw new Error('Clipboard error');
      });

      // The outer try-catch should handle this
      const result = await inserter.insert(text, 'paste');
      
      // Should still return success with clipboard method
      expect(result.success).toBe(true);
      expect(result.method).toBe('clipboard');
    });
  });
});
