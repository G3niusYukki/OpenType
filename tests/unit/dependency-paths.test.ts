import { describe, it, expect, vi } from 'vitest';
import { AudioCapture } from '../../src/main/audio-capture';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/user/data'),
  },
}));

describe('Missing Dependency Paths', () => {
  describe('AudioCapture without ffmpeg', () => {
    it('should handle missing audio devices gracefully', async () => {
      const capture = new AudioCapture();
      const devices = await capture.getAudioDevices();
      
      expect(Array.isArray(devices)).toBe(true);
    });

    it('should report status', async () => {
      const capture = new AudioCapture();
      const status = await capture.getStatus();
      
      expect(typeof status.ffmpegAvailable).toBe('boolean');
      expect(typeof status.hasAudioDevices).toBe('boolean');
    });
  });
});
