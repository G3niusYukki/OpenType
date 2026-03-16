import { systemPreferences } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type PermissionStatus = 'granted' | 'denied' | 'unknown';

export interface DiagnosticsResult {
  microphone: {
    status: PermissionStatus;
    message: string;
  };
  accessibility: {
    status: PermissionStatus;
    message: string;
  };
  automation: {
    status: PermissionStatus;
    message: string;
  };
  ffmpeg: {
    status: 'ok' | 'missing';
    version?: string;
    message: string;
  };
  whisper: {
    status: 'ok' | 'missing';
    path?: string;
    message: string;
  };
  model: {
    status: 'ok' | 'missing';
    path?: string;
    size?: number;
    message: string;
  };
  transcriptionProvider: {
    status: 'ok' | 'error';
    provider: string;
    message: string;
  };
}

export interface FailureRecord {
  timestamp: number;
  error: string;
  context: string;
}

export class DiagnosticsService {
  private lastFailure: FailureRecord | null = null;

  async runAllChecks(): Promise<DiagnosticsResult> {
    const [
      microphone,
      accessibility,
      automation,
      ffmpeg,
      whisper,
      model,
      transcriptionProvider
    ] = await Promise.all([
      this.checkMicrophonePermission(),
      this.checkAccessibilityPermission(),
      this.checkAutomationPermission(),
      this.checkFfmpeg(),
      this.checkWhisper(),
      this.checkModel(),
      this.checkTranscriptionProvider()
    ]);

    return {
      microphone,
      accessibility,
      automation,
      ffmpeg,
      whisper,
      model,
      transcriptionProvider
    };
  }

  async checkMicrophonePermission(): Promise<DiagnosticsResult['microphone']> {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      
      if (status === 'granted') {
        return {
          status: 'granted',
          message: 'Microphone access granted'
        };
      } else if (status === 'denied') {
        return {
          status: 'denied',
          message: 'Microphone access denied. Please enable in System Settings → Privacy & Security → Microphone'
        };
      } else {
        return {
          status: 'unknown',
          message: 'Microphone permission not determined. You may be prompted on first use.'
        };
      }
    } catch (error) {
      return {
        status: 'unknown',
        message: `Failed to check microphone permission: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async checkAccessibilityPermission(): Promise<DiagnosticsResult['accessibility']> {
    try {
      // Use AppleScript to check if we can query System Events
      const script = `
        tell application "System Events"
          return UI elements enabled
        end tell
      `;
      
      const { stdout } = await execAsync(`osascript -e '${script}'`, { timeout: 5000 });
      const enabled = stdout.trim() === 'true';
      
      if (enabled) {
        return {
          status: 'granted',
          message: 'Accessibility access granted'
        };
      } else {
        return {
          status: 'denied',
          message: 'Accessibility access denied. Please enable in System Settings → Privacy & Security → Accessibility'
        };
      }
    } catch (error) {
      // If AppleScript fails, it likely means accessibility is not granted
      return {
        status: 'denied',
        message: 'Accessibility access not granted. Please enable in System Settings → Privacy & Security → Accessibility'
      };
    }
  }

  async checkAutomationPermission(): Promise<DiagnosticsResult['automation']> {
    try {
      // Check if we can script System Events (automation permission)
      const script = `
        tell application "System Events"
          return name of first application process whose frontmost is true
        end tell
      `;
      
      await execAsync(`osascript -e '${script}'`, { timeout: 5000 });
      
      return {
        status: 'granted',
        message: 'Automation access granted'
      };
    } catch (error) {
      return {
        status: 'denied',
        message: 'Automation access not granted. Please enable in System Settings → Privacy & Security → Automation'
      };
    }
  }

  async checkFfmpeg(): Promise<DiagnosticsResult['ffmpeg']> {
    // Common ffmpeg installation paths on macOS
    const candidates = [
      '/opt/homebrew/bin/ffmpeg',      // Apple Silicon Homebrew
      '/usr/local/bin/ffmpeg',          // Intel Homebrew
      '/usr/bin/ffmpeg',                // System
    ];

    for (const path of candidates) {
      try {
        const { stdout } = await execAsync(`"${path}" -version`, { timeout: 5000 });
        const versionMatch = stdout.match(/version\s+(\S+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        return {
          status: 'ok',
          version,
          message: `ffmpeg ${version} installed`
        };
      } catch {
        // Continue to next candidate
      }
    }

    // Fallback: try PATH lookup (may not work in sandboxed app)
    try {
      const { stdout } = await execAsync('ffmpeg -version', { timeout: 5000 });
      const versionMatch = stdout.match(/version\s+(\S+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        status: 'ok',
        version,
        message: `ffmpeg ${version} installed`
      };
    } catch {
      return {
        status: 'missing',
        message: 'ffmpeg not found. Install with: brew install ffmpeg'
      };
    }
  }

  async checkWhisper(): Promise<DiagnosticsResult['whisper']> {
    const candidates = [
      '/opt/homebrew/bin/whisper-cpp',
      '/usr/local/bin/whisper-cpp',
      '/opt/homebrew/bin/whisper',
      '/usr/local/bin/whisper',
    ];

    for (const path of candidates) {
      try {
        await execAsync(`"${path}" --help`, { timeout: 5000 });
        return {
          status: 'ok',
          path,
          message: `whisper.cpp found at ${path}`
        };
      } catch {
        // Continue to next candidate
      }
    }

    return {
      status: 'missing',
      message: 'whisper.cpp not found. Install with: brew install whisper.cpp'
    };
  }

  async checkModel(): Promise<DiagnosticsResult['model']> {
    const fs = await import('fs');
    const path = await import('path');
    const { app } = await import('electron');

    const modelDir = path.join(app.getPath('userData'), 'models');
    const candidates = [
      path.join(modelDir, 'ggml-base.bin'),
      path.join(modelDir, 'ggml-small.bin'),
      path.join(modelDir, 'ggml-tiny.bin'),
      '/opt/homebrew/share/whisper.cpp/ggml-base.bin',
      '/usr/local/share/whisper.cpp/ggml-base.bin',
    ];

    for (const modelPath of candidates) {
      try {
        if (fs.existsSync(modelPath)) {
          const stats = fs.statSync(modelPath);
          const sizeMB = Math.round(stats.size / 1024 / 1024);
          return {
            status: 'ok',
            path: modelPath,
            size: sizeMB,
            message: `Model found (${sizeMB} MB)`
          };
        }
      } catch {
        // Continue to next candidate
      }
    }

    return {
      status: 'missing',
      message: 'Whisper model not found. Download with: curl -L -o ~/Library/Application\\ Support/OpenType/models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
    };
  }

  async checkTranscriptionProvider(): Promise<DiagnosticsResult['transcriptionProvider']> {
    // This will be populated by the main process with actual provider status
    // For now, return a placeholder that indicates the check is available
    return {
      status: 'ok',
      provider: 'checking...',
      message: 'Provider status will be checked when you start recording'
    };
  }

  recordFailure(error: Error, context: string): void {
    this.lastFailure = {
      timestamp: Date.now(),
      error: error.message,
      context
    };
  }

  getLastFailure(): FailureRecord | null {
    return this.lastFailure;
  }

  async openSettings(permissionType: 'microphone' | 'accessibility' | 'automation'): Promise<void> {
    const urls: Record<string, string> = {
      microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'
    };

    const { shell } = await import('electron');
    await shell.openExternal(urls[permissionType]);
  }
}
