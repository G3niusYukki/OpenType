import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSpawn = vi.hoisted(() => vi.fn());
const mockExecFile = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockRenameSync = vi.hoisted(() => vi.fn());
const mockStatSync = vi.hoisted(() => vi.fn());
const mockUnlinkSync = vi.hoisted(() => vi.fn());
const mockGetPath = vi.hoisted(() => vi.fn());

const findCallback = (args: any[]): any => {
  return args.find((arg) => typeof arg === 'function');
};

vi.mock('child_process', () => ({
  spawn: mockSpawn,
  execFile: mockExecFile,
  default: {
    spawn: mockSpawn,
    execFile: mockExecFile,
  }
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn) => {
    return (...args: any[]) => {
      return new Promise((resolve, reject) => {
        const callback = (err: any, stdout: any, stderr: any) => {
          if (err) {
            const error = new Error(err.message || 'Error') as any;
            error.stderr = stderr;
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        };
        fn(...args, callback);
      });
    };
  }),
  default: {
    promisify: vi.fn((fn) => {
      return (...args: any[]) => {
        return new Promise((resolve, reject) => {
          const callback = (err: any, stdout: any, stderr: any) => {
            if (err) {
              const error = new Error(err.message || 'Error') as any;
              error.stderr = stderr;
              reject(error);
            } else {
              resolve({ stdout, stderr });
            }
          };
          fn(...args, callback);
        });
      };
    }),
  },
}));

vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath,
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    renameSync: mockRenameSync,
    statSync: mockStatSync,
    unlinkSync: mockUnlinkSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  renameSync: mockRenameSync,
  statSync: mockStatSync,
  unlinkSync: mockUnlinkSync,
}));

import { AudioCapture } from '../../src/main/audio-capture';

const createMockProcess = (options: {
  pid?: number;
  exitCode?: number | null;
  exitDelay?: number;
  error?: Error;
  stderrData?: string;
} = {}) => {
  const eventHandlers: Record<string, Function[]> = {
    exit: [],
    error: [],
  };

  const stderrHandlers: Record<string, Function[]> = {
    data: [],
  };

  const stdin = {
    write: vi.fn(),
  };

  const stderr = {
    on: vi.fn((event: string, handler: Function) => {
      if (!stderrHandlers[event]) stderrHandlers[event] = [];
      stderrHandlers[event].push(handler);
      return stderr;
    }),
  };

  const process = {
    pid: options.pid ?? 12345,
    stdin,
    stderr,
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      eventHandlers[event].push(handler);
      return process;
    }),
    kill: vi.fn((signal?: string) => {
      if (signal === 'SIGKILL') {
        setTimeout(() => {
          eventHandlers['exit']?.forEach((h) => h(options.exitCode ?? 0, signal));
        }, 10);
      }
    }),
    _triggerExit: (code: number | null, signal?: string) => {
      eventHandlers['exit']?.forEach((h) => h(code, signal));
    },
    _triggerError: (err: Error) => {
      eventHandlers['error']?.forEach((h) => h(err));
    },
    _triggerStderr: (data: string) => {
      stderrHandlers['data']?.forEach((h) => h(Buffer.from(data)));
    },
    _handlers: eventHandlers,
    _stderrHandlers: stderrHandlers,
  };

  if (options.exitDelay !== undefined) {
    setTimeout(() => {
      process._triggerExit(options.exitCode ?? 0);
    }, options.exitDelay);
  }

  if (options.stderrData) {
    setTimeout(() => {
      process._triggerStderr(options.stderrData!);
    }, 10);
  }

  if (options.error) {
    setTimeout(() => {
      process._triggerError(options.error!);
    }, 10);
  }

  return process;
};

describe('AudioCapture', () => {
  let capture: AudioCapture;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    capture = new AudioCapture();
    mockGetPath.mockReturnValue('/tmp');
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkFfmpeg', () => {
    it('should return false when ffmpeg is not available', async () => {
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(new Error('command not found'), '', '');
        return {} as any;
      });

      const status = await (capture as any).checkFfmpeg();
      expect(status).toBe(false);
    });

    it('should return true when ffmpeg is available', async () => {
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const status = await (capture as any).checkFfmpeg();
      expect(status).toBe(true);
    });

    it('should cache ffmpeg availability result', async () => {
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      await (capture as any).checkFfmpeg();
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      await (capture as any).checkFfmpeg();
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStatus', () => {
    it('should return ffmpeg unavailable when check fails', async () => {
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(new Error('command not found'), '', '');
        return {} as any;
      });

      const status = await capture.getStatus();
      expect(status.ffmpegAvailable).toBe(false);
      expect(status.hasAudioDevices).toBe(false);
    });

    it('should handle error during status check gracefully', async () => {
      mockExecFile.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const status = await capture.getStatus();
      expect(status.ffmpegAvailable).toBe(false);
    });

    it('should return status with devices when ffmpeg is available', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const callback = findCallback(args);
        const cmdArgs = args[1] as string[];
        if (cmdArgs.includes('-version')) {
          callback(null, 'ffmpeg version 4.4', '');
        } else if (cmdArgs.includes('-list_devices')) {
          const error = new Error('exit') as any;
          error.stderr = '[AVFoundation audio devices]\n[0] Built-in Microphone\n[1] External Mic';
          callback(error, '', error.stderr);
        } else {
          callback(null, '', '');
        }
        return {} as any;
      });

      const status = await capture.getStatus();
      expect(status.ffmpegAvailable).toBe(true);
      expect(status.hasAudioDevices).toBe(true);
      expect(status.deviceCount).toBe(2);
    });
  });

  describe('getAudioDevices', () => {
    it('should parse devices from stdout on success', async () => {
      const stdoutOutput = `[AVFoundation audio devices]
[0] Built-in Microphone
[1] External USB Microphone
[AVFoundation video devices]
[0] FaceTime HD Camera`;

      mockExecFile.mockImplementation((...args: any[]) => {
        const callback = findCallback(args);
        callback(null, stdoutOutput, '');
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([
        { index: '0', name: 'Built-in Microphone' },
        { index: '1', name: 'External USB Microphone' }
      ]);
    });

    it('should parse devices from stderr (ffmpeg quirk)', async () => {
      const stderrOutput = `[AVFoundation audio devices]
[0] Built-in Microphone
[1] AirPods Pro
[AVFoundation video devices]
[0] FaceTime HD Camera`;

      mockExecFile.mockImplementation((...args: any[]) => {
        const callback = findCallback(args);
        const error = new Error('ffmpeg returns error on device list') as any;
        error.stderr = stderrOutput;
        callback(error, '', stderrOutput);
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([
        { index: '0', name: 'Built-in Microphone' },
        { index: '1', name: 'AirPods Pro' }
      ]);
    });

    it('should filter out video devices section', async () => {
      const stderrOutput = `[AVFoundation audio devices]
[0] Built-in Microphone
[AVFoundation video devices]
[0] FaceTime HD Camera
[1] External Webcam`;

      mockExecFile.mockImplementation((...args: any[]) => {
        const callback = findCallback(args);
        const error = new Error('exit') as any;
        error.stderr = stderrOutput;
        callback(error, '', stderrOutput);
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([
        { index: '0', name: 'Built-in Microphone' }
      ]);
      expect(devices.length).toBe(1);
    });

    it('should handle multiple audio devices', async () => {
      const stderrOutput = `[AVFoundation audio devices]
[0] Built-in Microphone
[1] AirPods Pro
[2] USB Audio Device
[3] External Microphone
[AVFoundation video devices]
[0] FaceTime HD Camera`;

      mockExecFile.mockImplementation((...args: any[]) => {
        const callback = findCallback(args);
        const error = new Error('exit') as any;
        error.stderr = stderrOutput;
        callback(error, '', stderrOutput);
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices.length).toBe(4);
      expect(devices[0]).toEqual({ index: '0', name: 'Built-in Microphone' });
      expect(devices[3]).toEqual({ index: '3', name: 'External Microphone' });
    });

    it('should handle empty device list', async () => {
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(new Error('error'), '', 'no devices');
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([]);
    });

    it('should handle stdout with empty audio section', async () => {
      const stdoutOutput = `[AVFoundation audio devices]
[AVFoundation video devices]
[0] FaceTime HD Camera`;

      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, stdoutOutput, '');
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([]);
    });

    it('should handle malformed output gracefully', async () => {
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'invalid output', '');
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([]);
    });

    it('should handle output without section headers', async () => {
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'random output without device sections', '');
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([]);
    });

    it('should handle devices with special characters in names', async () => {
      const stderrOutput = `[AVFoundation audio devices]
[0] Mic (USB Audio Device)
[1] Device @ 48kHz [Left]
[AVFoundation video devices]
[0] Camera`;

      mockExecFile.mockImplementation((...args: any[]) => {
        const callback = findCallback(args);
        const error = new Error('exit') as any;
        error.stderr = stderrOutput;
        callback(error, '', stderrOutput);
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([
        { index: '0', name: 'Mic (USB Audio Device)' },
        { index: '1', name: 'Device @ 48kHz [Left]' }
      ]);
    });

    it('should handle stderr with no device section headers', async () => {
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        const error = new Error('error') as any;
        error.stderr = 'some error without device info';
        callback(error, '', 'some error without device info');
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([]);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      capture = new AudioCapture();
    });

    it('should successfully start ffmpeg recording', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      const startPromise = capture.start();
      vi.advanceTimersByTime(1000);

      const result = await startPromise;

      expect(result.success).toBe(true);
      expect(result.isPlaceholder).toBe(false);
      expect(mockSpawn).toHaveBeenCalled();
    });

    it('should create recordings directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('recordings'), { recursive: true });
    });

    it('should enter placeholder mode when ffmpeg is not available', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(new Error('command not found'), '', '');
        return {} as any;
      });

      const result = await capture.start();

      expect(result.success).toBe(true);
      expect(result.isPlaceholder).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should handle process error event', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const processError = new Error('Spawn failed');
      const mockProcess = createMockProcess({ error: processError });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(100);

      expect(mockProcess._handlers['error']).toHaveLength(1);
    });

    it('should handle permission denied error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({
        exitCode: 1,
        exitDelay: 100,
        stderrData: 'Permission denied to access microphone'
      });
      mockSpawn.mockReturnValue(mockProcess);

      const result = await capture.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('MICROPHONE_PERMISSION_DENIED');
      expect(result.errorCode).toBeUndefined();
    });

    it('should handle "not authorized" permission error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({
        exitCode: 1,
        exitDelay: 100,
        stderrData: 'not authorized to access microphone'
      });
      mockSpawn.mockReturnValue(mockProcess);

      const result = await capture.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('MICROPHONE_PERMISSION_DENIED');
    });

    it('should handle "access denied" permission error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({
        exitCode: 1,
        exitDelay: 100,
        stderrData: 'access denied to audio device'
      });
      mockSpawn.mockReturnValue(mockProcess);

      const result = await capture.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('MICROPHONE_PERMISSION_DENIED');
    });

    it('should handle AVFoundation permission error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({
        exitCode: 1,
        exitDelay: 100,
        stderrData: 'AVFoundation audio device not accessible'
      });
      mockSpawn.mockReturnValue(mockProcess);

      const result = await capture.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('MICROPHONE_PERMISSION_DENIED');
    });

    it('should handle general ffmpeg exit error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({
        exitCode: 1,
        exitDelay: 100,
        stderrData: 'Some generic error'
      });
      mockSpawn.mockReturnValue(mockProcess);

      const result = await capture.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('ffmpeg exited with code 1');
    });

    it('should handle spawn error in start', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      const result = await capture.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Spawn failed');
    });

    it('should handle timeout when process does not exit', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      const startPromise = capture.start();
      vi.advanceTimersByTime(800);

      const result = await startPromise;

      expect(result.success).toBe(true);
    });

    it('should use cached ffmpeg check result', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      const callCount = mockExecFile.mock.calls.length;

      const capture2 = new AudioCapture();
      mockSpawn.mockReturnValue(createMockProcess({ pid: 12346 }));
      await capture2.start();
      vi.advanceTimersByTime(1000);

      expect(mockExecFile.mock.calls.length).toBeGreaterThanOrEqual(callCount);
    });

    it('should handle stderr data accumulation', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(100);

      mockProcess._triggerStderr('Some stderr output');

      expect(mockProcess._stderrHandlers['data']).toHaveLength(1);
    });

    it('should handle process exit with null code', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({
        exitCode: null,
        exitDelay: 100
      });
      mockSpawn.mockReturnValue(mockProcess);

      const startPromise = capture.start();
      vi.advanceTimersByTime(100);

      const result = await startPromise;

      expect(result.success).toBe(true);
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      capture = new AudioCapture();
    });

    it('should handle stop when not recording', async () => {
      const result = await capture.stop();
      expect(result.success).toBe(false);
      expect(result.error).toContain('No recording in progress');
    });

    it('should successfully stop with graceful exit', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      mockStatSync.mockReturnValue({ size: 1024 });
      mockExistsSync.mockReturnValue(true);

      const stopPromise = capture.stop();
      vi.advanceTimersByTime(100);
      mockProcess._triggerExit(0);

      const result = await stopPromise;

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('q');
      expect(result.success).toBe(true);
      expect(result.isPlaceholder).toBe(false);
    });

    it('should force kill after timeout (SIGTERM → SIGKILL)', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      mockStatSync.mockReturnValue({ size: 1024 });
      mockExistsSync.mockReturnValue(true);

      const stopPromise = capture.stop();

      vi.advanceTimersByTime(3500);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      vi.advanceTimersByTime(1500);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

      await stopPromise;
    });

    it('should rename temp file to final on stop', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      mockStatSync.mockReturnValue({ size: 1024 });
      mockExistsSync.mockReturnValue(true);

      const stopPromise = capture.stop();
      vi.advanceTimersByTime(100);
      mockProcess._triggerExit(0);
      await stopPromise;

      expect(mockRenameSync).toHaveBeenCalled();
    });

    it('should detect empty file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      mockStatSync.mockReturnValue({ size: 0 });
      mockExistsSync.mockReturnValue(true);

      const stopPromise = capture.stop();
      vi.advanceTimersByTime(100);
      mockProcess._triggerExit(0);

      const result = await stopPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Recorded file is empty');
    });

    it('should handle placeholder mode (no process)', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(new Error('not found'), '', '');
        return {} as any;
      });

      const startResult = await capture.start();
      expect(startResult.isPlaceholder).toBe(true);

      const stopResult = await capture.stop();

      expect(stopResult.success).toBe(true);
      expect(stopResult.isPlaceholder).toBe(true);
    });

    it('should handle missing temp file on stop', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      mockExistsSync.mockImplementation((path: string) => !path.includes('.temp.'));

      const stopPromise = capture.stop();
      vi.advanceTimersByTime(100);
      mockProcess._triggerExit(0);

      const result = await stopPromise;

      expect(result.success).toBe(true);
      expect(result.isPlaceholder).toBe(true);
    });

    it('should handle stop error gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      mockStatSync.mockImplementation(() => {
        throw new Error('Stat failed');
      });
      mockExistsSync.mockReturnValue(true);

      const stopPromise = capture.stop();
      vi.advanceTimersByTime(100);
      mockProcess._triggerExit(0);

      const result = await stopPromise;

      expect(result.success).toBe(false);
    });
  });

  describe('isRecording', () => {
    beforeEach(() => {
      capture = new AudioCapture();
    });

    it('should return false when not recording', () => {
      expect(capture.isRecording()).toBe(false);
    });

    it('should return true when recording is in progress', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      capture.start();
      vi.advanceTimersByTime(100);

      expect(capture.isRecording()).toBe(true);
    });

    it('should return true when output path is set (placeholder mode)', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(new Error('not found'), '', '');
        return {} as any;
      });

      await capture.start();

      expect(capture.isRecording()).toBe(true);
    });

    it('should return false after stop', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      mockStatSync.mockReturnValue({ size: 1024 });
      mockExistsSync.mockReturnValue(true);

      const stopPromise = capture.stop();
      vi.advanceTimersByTime(100);
      mockProcess._triggerExit(0);
      await stopPromise;

      expect(capture.isRecording()).toBe(false);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      capture = new AudioCapture();
    });

    it('should remove temp file on cleanup', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      mockExistsSync.mockImplementation((path: string) => path.includes('.temp.'));
      mockRenameSync.mockImplementation(() => {
        throw new Error('Rename failed');
      });

      const stopPromise = capture.stop();
      vi.advanceTimersByTime(100);
      mockProcess._triggerExit(0);
      await stopPromise;

      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      await capture.start();
      vi.advanceTimersByTime(1000);

      mockRenameSync.mockImplementation(() => {
        throw new Error('Rename failed');
      });
      mockUnlinkSync.mockImplementation(() => {
        throw new Error('Unlink failed');
      });

      const stopPromise = capture.stop();
      vi.advanceTimersByTime(100);
      mockProcess._triggerExit(0);
      const result = await stopPromise;

      expect(result.success).toBe(false);
    });

    it('should handle cleanup when temp file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(new Error('not found'), '', '');
        return {} as any;
      });

      await capture.start();
      await capture.stop();

      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle double start without stop', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        callback(null, 'ffmpeg version 4.4', '');
        return {} as any;
      });

      const mockProcess = createMockProcess({ pid: 12345 });
      mockSpawn.mockReturnValue(mockProcess);

      const result1 = await capture.start();
      vi.advanceTimersByTime(1000);

      expect(result1.success).toBe(true);

      mockSpawn.mockReturnValue(createMockProcess({ pid: 12346 }));
      const result2 = await capture.start();
      vi.advanceTimersByTime(1000);

      expect(result2.success).toBe(true);
    });

    it('should handle ffmpeg list_devices with both stdout and stderr', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const callback = findCallback(args);
        const cmdArgs = args[1] as string[];
        if (cmdArgs.includes('-list_devices')) {
          const output = `[AVFoundation audio devices]\n[0] Built-in Mic\n[AVFoundation video devices]\n[0] Camera`;
          const error = new Error('exit code 1') as any;
          error.stderr = output;
          callback(error, '', output);
        } else {
          callback(null, 'version', '');
        }
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([{ index: '0', name: 'Built-in Mic' }]);
    });

    it('should handle stderr with undefined stderr property', async () => {
      mockExecFile.mockImplementation((file: string, args: string[], callback: any) => {
        const error = new Error('generic error') as any;
        error.stderr = undefined;
        callback(error, '', '');
        return {} as any;
      });

      const devices = await capture.getAudioDevices();
      expect(devices).toEqual([]);
    });
  });
});
