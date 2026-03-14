import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioCapture } from '../../src/main/audio-capture';
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';

// Mock child_process
vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

// Mock fs
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

describe('AudioCapture', () => {
  let capture: AudioCapture;

  beforeEach(() => {
    vi.clearAllMocks();
    capture = new AudioCapture();
  });

  describe('checkFfmpeg', () => {
    it('should return false when ffmpeg is not available', async () => {
      vi.mocked(execFile).mockImplementation((file: string, args: string[], callback: any) => {
        callback(new Error('command not found'), null, null);
        return {} as any;
      });

      const status = await (capture as any).checkFfmpeg();
      
      expect(status).toBe(false);
    });

    it('should return true when ffmpeg is available', async () => {
      vi.mocked(execFile).mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const status = await (capture as any).checkFfmpeg();
      
      expect(status).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return ffmpeg unavailable when check fails', async () => {
      vi.mocked(execFile).mockImplementation((file: string, args: string[], callback: any) => {
        callback(new Error('command not found'), null, null);
        return {} as any;
      });

      const status = await capture.getStatus();

      expect(status.ffmpegAvailable).toBe(false);
      expect(status.hasAudioDevices).toBe(false);
      expect(status.deviceCount).toBe(0);
    });
  });

  describe('stop', () => {
    it('should handle stop when not recording', async () => {
      const result = await capture.stop();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No recording');
    });
  });
});