import { EventEmitter } from 'events';
import { vi } from 'vitest';

type MockFn<T extends (...args: any[]) => any> = ReturnType<typeof vi.fn<T>>;

export interface MockProcessStream extends EventEmitter {
  setEncoding: MockFn<(encoding: BufferEncoding) => void>;
}

export interface MockProcess extends EventEmitter {
  pid: number;
  stdout: MockProcessStream;
  stderr: MockProcessStream;
  kill: MockFn<(signal?: NodeJS.Signals | number) => boolean>;
  _triggerExit: (code?: number | null, signal?: NodeJS.Signals | null) => void;
  _triggerError: (error: Error) => void;
}

export interface ProcessMockHelpers {
  mockSpawn: MockFn<(...args: unknown[]) => MockProcess>;
  mockExecFile: MockFn<(...args: unknown[]) => MockProcess>;
  module: {
    spawn: MockFn<(...args: unknown[]) => MockProcess>;
    execFile: MockFn<(...args: unknown[]) => MockProcess>;
    default: {
      spawn: MockFn<(...args: unknown[]) => MockProcess>;
      execFile: MockFn<(...args: unknown[]) => MockProcess>;
    };
  };
  createMockProcess: () => MockProcess;
  resetProcessMocks: () => void;
}

const createMockStream = (): MockProcessStream => {
  const stream = new EventEmitter() as MockProcessStream;
  stream.setEncoding = vi.fn<(encoding: BufferEncoding) => void>();
  return stream;
};

/**
 * Creates child process mocks with manual event triggers.
 *
 * @example
 * ```ts
 * import { beforeEach, expect, it, vi } from 'vitest';
 * import { createProcessMock } from './mocks';
 *
 * const { mockSpawn, createMockProcess, resetProcessMocks } = createProcessMock();
 * vi.mock('child_process', () => ({ spawn: mockSpawn, execFile: vi.fn() }));
 *
 * beforeEach(() => {
 *   resetProcessMocks();
 * });
 *
 * it('simulates a successful exit', () => {
 *   const process = createMockProcess();
 *   mockSpawn.mockReturnValue(process);
 *   process._triggerExit(0);
 *   expect(mockSpawn).toHaveBeenCalled();
 * });
 * ```
 */
export const createProcessMock = (): ProcessMockHelpers => {
  let nextPid = 1;

  const createMockProcess = (): MockProcess => {
    const process = new EventEmitter() as MockProcess;
    process.pid = nextPid++;
    process.stdout = createMockStream();
    process.stderr = createMockStream();
    process.kill = vi.fn<(signal?: NodeJS.Signals | number) => boolean>().mockReturnValue(true);
    process._triggerExit = (code = 0, signal = null) => {
      process.emit('exit', code, signal);
      process.emit('close', code, signal);
    };
    process._triggerError = (error: Error) => {
      process.emit('error', error);
    };
    return process;
  };

  const mockSpawn = vi.fn<(...args: unknown[]) => MockProcess>(() => createMockProcess());
  const mockExecFile = vi.fn<(...args: unknown[]) => MockProcess>((...args) => {
    const callback = args.find((arg): arg is ((error: Error | null, stdout: string, stderr: string) => void) => typeof arg === 'function');
    const process = createMockProcess();

    if (callback) {
      callback(null, '', '');
    }

    return process;
  });

  const module = {
    spawn: mockSpawn,
    execFile: mockExecFile,
    default: {
      spawn: mockSpawn,
      execFile: mockExecFile,
    },
  };

  const resetProcessMocks = (): void => {
    nextPid = 1;
    mockSpawn.mockReset();
    mockSpawn.mockImplementation(() => createMockProcess());
    mockExecFile.mockReset();
    mockExecFile.mockImplementation((...args) => {
      const callback = args.find((arg): arg is ((error: Error | null, stdout: string, stderr: string) => void) => typeof arg === 'function');
      const process = createMockProcess();

      if (callback) {
        callback(null, '', '');
      }

      return process;
    });
  };

  return {
    mockSpawn,
    mockExecFile,
    module,
    createMockProcess,
    resetProcessMocks,
  };
};

export default createProcessMock;
