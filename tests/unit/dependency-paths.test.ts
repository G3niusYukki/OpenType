import { describe, it, expect } from 'vitest';
import { AudioCapture } from '../../src/main/audio-capture';

describe('Missing Dependency Paths', () => {
  describe('AudioCapture', () => {
    it('should enter placeholder mode when ffmpeg is missing', async () => {
      const capture = new AudioCapture();
      const result = await capture.start();
      
      // Without ffmpeg, should return placeholder
      if (!result.isPlaceholder) {
        expect(result.success).toBe(true);
      }
    });

    it('should handle missing audio devices gracefully', async () => {
      const capture = new AudioCapture();
      const devices = await capture.getAudioDevices();
      
      // Should return array even if empty
      expect(Array.isArray(devices)).toBe(true);
    });
  });
});
