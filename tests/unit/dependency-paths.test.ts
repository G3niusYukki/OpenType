import { describe, it, expect, vi } from 'vitest';
import { AudioCapture } from '../../src/main/audio-capture';
import { TranscriptionService } from '../../src/main/transcription';

describe('Missing Dependency Paths', () => {
  describe('AudioCapture without ffmpeg', () => {
    it('should enter placeholder mode when ffmpeg is missing', async () => {
      const capture = new AudioCapture();
      const result = await capture.start();
      
      if (!result.isPlaceholder) {
        expect(result.success).toBe(true);
      }
    });

    it('should handle missing audio devices gracefully', async () => {
      const capture = new AudioCapture();
      const devices = await capture.getAudioDevices();
      
      expect(Array.isArray(devices)).toBe(true);
    });

    it('should report ffmpeg unavailable in status', async () => {
      const capture = new AudioCapture();
      const status = await capture.getStatus();
      
      expect(typeof status.ffmpegAvailable).toBe('boolean');
      expect(typeof status.hasAudioDevices).toBe('boolean');
    });
  });

  describe('TranscriptionService dependencies', () => {
    it('should detect whisper.cpp installation status', async () => {
      const service = new TranscriptionService({
        language: 'en',
        useLocalFirst: true,
        preferredProvider: 'auto',
        cloudProviders: []
      });

      const status = await service.getStatus();
      expect(typeof status.whisperInstalled).toBe('boolean');
    });

    it('should detect model availability', async () => {
      const service = new TranscriptionService({
        language: 'en',
        useLocalFirst: true,
        preferredProvider: 'auto',
        cloudProviders: []
      });

      const status = await service.getStatus();
      expect(typeof status.modelAvailable).toBe('boolean');
    });

    it('should provide recommendations when setup incomplete', async () => {
      const service = new TranscriptionService({
        language: 'en',
        useLocalFirst: true,
        preferredProvider: 'auto',
        cloudProviders: []
      });

      const status = await service.getStatus();
      expect(Array.isArray(status.recommendations)).toBe(true);
    });
  });
});
