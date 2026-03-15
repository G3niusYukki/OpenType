import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);

export interface AudioCaptureResult {
  success: boolean;
  audioPath?: string;
  error?: string;
  isPlaceholder?: boolean;
  errorCode?: 'ffmpeg-missing' | 'mic-permission' | 'unknown';
}

export interface AudioDeviceStatus {
  available: boolean;
  deviceCount: number;
  devices: Array<{ index: string; name: string }>;
  hasFfmpeg: boolean;
  permissionStatus?: 'granted' | 'denied' | 'unknown';
}

/**
 * AudioCapture - Handles microphone recording on macOS
 * 
 * Primary: Uses ffmpeg with AVFoundation (macOS native)
 * Fallback: Creates placeholder file with error information
 */
export class AudioCapture {
  private recordingProcess: ReturnType<typeof spawn> | null = null;
  private currentOutputPath: string | null = null;
  private currentTempPath: string | null = null;
  private ffmpegAvailable: boolean | null = null;

  /**
   * Check if ffmpeg is available on the system
   */
  private async checkFfmpeg(): Promise<boolean> {
    if (this.ffmpegAvailable !== null) return this.ffmpegAvailable;
    
    try {
      await execFileAsync('ffmpeg', ['-version']);
      this.ffmpegAvailable = true;
      return true;
    } catch {
      this.ffmpegAvailable = false;
      return false;
    }
  }

  /**
   * Get comprehensive audio capture status including ffmpeg and devices
   */
  async getStatus(): Promise<{
    ffmpegAvailable: boolean;
    hasAudioDevices: boolean;
    deviceCount: number;
    devices: Array<{ index: string; name: string }>;
  }> {
    try {
      const hasFfmpeg = await this.checkFfmpeg();
      const devices = hasFfmpeg ? await this.getAudioDevices() : [];
      
      return {
        ffmpegAvailable: hasFfmpeg,
        hasAudioDevices: devices.length > 0,
        deviceCount: devices.length,
        devices
      };
    } catch (error) {
      console.error('[AudioCapture] Failed to get status:', error);
      return {
        ffmpegAvailable: false,
        hasAudioDevices: false,
        deviceCount: 0,
        devices: []
      };
    }
  }

  /**
   * Get the audio device list from ffmpeg
   */
  async getAudioDevices(): Promise<Array<{ index: string; name: string }>> {
    try {
      const { stdout } = await execFileAsync('ffmpeg', [
        '-f', 'avfoundation',
        '-list_devices', 'true',
        '-i', ''
      ], { encoding: 'utf8' });
      
      // Parse ffmpeg output for audio devices
      // Format: [AVFoundation ...] [0] Device Name
      const devices: Array<{ index: string; name: string }> = [];
      const lines = (stdout || '').split('\n');
      let inAudioSection = false;
      
      for (const line of lines) {
        if (line.includes('AVFoundation audio devices')) {
          inAudioSection = true;
          continue;
        }
        if (line.includes('AVFoundation video devices')) {
          inAudioSection = false;
          continue;
        }
        if (inAudioSection) {
          const match = line.match(/\[(\d+)\]\s*(.+)/);
          if (match) {
            devices.push({ index: match[1], name: match[2].trim() });
          }
        }
      }
      
      return devices;
    } catch (error: any) {
      // ffmpeg returns error code even when listing devices
      const stderr = error?.stderr || '';
      const devices: Array<{ index: string; name: string }> = [];
      const lines = stderr.split('\n');
      let inAudioSection = false;
      
      for (const line of lines) {
        if (line.includes('AVFoundation audio devices')) {
          inAudioSection = true;
          continue;
        }
        if (line.includes('AVFoundation video devices')) {
          inAudioSection = false;
          continue;
        }
        if (inAudioSection) {
          const match = line.match(/\[(\d+)\]\s*(.+)/);
          if (match) {
            devices.push({ index: match[1], name: match[2].trim() });
          }
        }
      }
      
      return devices;
    }
  }

  async start(deviceIndex?: string): Promise<AudioCaptureResult> {
    try {
      // Ensure recordings directory exists
      const recordingsDir = path.join(app.getPath('userData'), 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      // Generate output paths
      const timestamp = Date.now();
      this.currentOutputPath = path.join(recordingsDir, `recording_${timestamp}.wav`);
      this.currentTempPath = path.join(recordingsDir, `recording_${timestamp}.temp.wav`);

      // Check ffmpeg availability
      const hasFfmpeg = await this.checkFfmpeg();
      
      if (!hasFfmpeg) {
        console.warn('[AudioCapture] ffmpeg not found, using placeholder mode');
        // Create placeholder file
        fs.writeFileSync(this.currentOutputPath, '');
        return {
          success: true,
          audioPath: this.currentOutputPath,
          isPlaceholder: true,
          error: 'ffmpeg not available - audio not recorded'
        };
      }

      // Validate device index if provided
      let selectedDevice = ':0'; // Default device
      if (deviceIndex) {
        const devices = await this.getAudioDevices();
        const deviceExists = devices.some(d => d.index === deviceIndex);
        if (deviceExists) {
          selectedDevice = `:${deviceIndex}`;
          console.log(`[AudioCapture] Using selected device: ${selectedDevice}`);
        } else {
          console.warn(`[AudioCapture] Selected device ${deviceIndex} not available, falling back to default`);
        }
      }

      // Start ffmpeg recording
      // -f avfoundation: Use macOS AVFoundation framework
      // -i ":0": Use default audio input device (or specific index)
      // -ar 16000: 16kHz sample rate (optimal for Whisper)
      // -ac 1: Mono audio
      // -c:a pcm_s16le: 16-bit PCM WAV format
      // -y: Overwrite output file
      console.log(`[AudioCapture] Starting ffmpeg recording to: ${this.currentTempPath}`);
      
      this.recordingProcess = spawn('ffmpeg', [
        '-f', 'avfoundation',
        '-i', selectedDevice,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-y',
        this.currentTempPath
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let errorOutput = '';
      this.recordingProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      this.recordingProcess.on('error', (error) => {
        console.error('[AudioCapture] ffmpeg process error:', error);
      });

      // Wait a moment to ensure ffmpeg started successfully
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (this.recordingProcess?.pid) {
            resolve(void 0);
          }
        }, 800);
        
        this.recordingProcess?.on('exit', (code) => {
          clearTimeout(timeout);
          if (code !== 0 && code !== null) {
            // Check for permission denied error
            if (errorOutput.includes('Permission denied') || 
                errorOutput.includes('not authorized') ||
                errorOutput.includes('access denied') ||
                errorOutput.includes('AVFoundation')) {
              reject(new Error('MICROPHONE_PERMISSION_DENIED'));
            } else {
              reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
            }
          }
        });
      });

      console.log(`[AudioCapture] Recording started with ffmpeg (PID: ${this.recordingProcess?.pid})`);
      
      return {
        success: true,
        audioPath: this.currentOutputPath,
        isPlaceholder: false
      };
    } catch (error: any) {
      console.error('[AudioCapture] Failed to start:', error);
      
      // Cleanup on error
      this.cleanup();
      
      return {
        success: false,
        error: error?.message || 'Unknown error starting recording'
      };
    }
  }

  async stop(): Promise<AudioCaptureResult> {
    if (!this.currentOutputPath) {
      return {
        success: false,
        error: 'No recording in progress'
      };
    }

    try {
      if (this.recordingProcess) {
        // Gracefully stop ffmpeg
        // Send 'q' to stdin to trigger graceful shutdown
        this.recordingProcess.stdin?.write('q');
        
        // Wait for process to exit (with timeout)
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Force kill if not exited
            this.recordingProcess?.kill('SIGTERM');
            setTimeout(() => {
              this.recordingProcess?.kill('SIGKILL');
              resolve();
            }, 1000);
          }, 3000);
          
          this.recordingProcess?.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        
        this.recordingProcess = null;
        
        // Move temp file to final location
        if (this.currentTempPath && fs.existsSync(this.currentTempPath)) {
          fs.renameSync(this.currentTempPath, this.currentOutputPath);
          
          // Verify file has content
          const stats = fs.statSync(this.currentOutputPath);
          if (stats.size === 0) {
            return {
              success: false,
              error: 'Recorded file is empty'
            };
          }
          
          console.log(`[AudioCapture] Recording saved: ${this.currentOutputPath} (${stats.size} bytes)`);
          
          return {
            success: true,
            audioPath: this.currentOutputPath,
            isPlaceholder: false
          };
        }
      }
      
      // If we get here with no process, it was a placeholder
      return {
        success: true,
        audioPath: this.currentOutputPath,
        isPlaceholder: true
      };
    } catch (error: any) {
      console.error('[AudioCapture] Failed to stop:', error);
      
      return {
        success: false,
        error: error?.message || 'Unknown error stopping recording'
      };
    } finally {
      this.cleanup();
    }
  }

  isRecording(): boolean {
    return this.recordingProcess !== null || this.currentOutputPath !== null;
  }

  private cleanup(): void {
    // Clean up temp file if exists
    if (this.currentTempPath && fs.existsSync(this.currentTempPath)) {
      try {
        fs.unlinkSync(this.currentTempPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    this.recordingProcess = null;
    this.currentOutputPath = null;
    this.currentTempPath = null;
  }
}
