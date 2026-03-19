import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { UpdateProvider, useUpdate } from '@renderer/contexts/UpdateContext';
import { createElectronAPIMock } from './mocks/electronAPI';

function TestConsumer() {
  const { hasUpdate, updateInfo, isChecking, error, isDismissed, checkUpdate, dismissUpdate } = useUpdate();
  return (
    <div>
      <span data-testid="hasUpdate">{String(hasUpdate)}</span>
      <span data-testid="status">{updateInfo?.status ?? 'null'}</span>
      <span data-testid="version">{updateInfo?.version ?? 'null'}</span>
      <span data-testid="isChecking">{String(isChecking)}</span>
      <span data-testid="error">{error ?? 'null'}</span>
      <span data-testid="isDismissed">{String(isDismissed)}</span>
      <button data-testid="checkBtn" onClick={() => checkUpdate()}>Check</button>
      <button data-testid="dismissBtn" onClick={() => dismissUpdate()}>Dismiss</button>
    </div>
  );
}

describe('UpdateContext', () => {
  const { electronAPI, assignToWindow, resetElectronAPIMock } = createElectronAPIMock();

  beforeEach(() => {
    vi.useFakeTimers();
    assignToWindow();
    localStorage.clear();
    resetElectronAPIMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initializes with idle state from updateGetState', async () => {
    electronAPI.updateGetState.mockResolvedValue({ status: 'idle', version: '0.3.0' });
    electronAPI.onUpdateState.mockReturnValue(() => {});

    render(
      <UpdateProvider>
        <TestConsumer />
      </UpdateProvider>
    );

    // Wait for the initial updateGetState call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId('status').textContent).toBe('idle');
    expect(screen.getByTestId('hasUpdate').textContent).toBe('false');
    expect(screen.getByTestId('isDismissed').textContent).toBe('false');
  });

  it('sets isChecking to true while checkUpdate is in progress', async () => {
    electronAPI.updateGetState.mockResolvedValue({ status: 'idle' });
    electronAPI.onUpdateState.mockReturnValue(() => {});
    // Use a controlled promise so we can verify isChecking is true during the check
    let resolveUpdateCheck: () => void;
    const updateCheckPromise = new Promise<void>((resolve) => {
      resolveUpdateCheck = resolve;
    });
    electronAPI.updateCheck.mockReturnValue(updateCheckPromise);

    render(
      <UpdateProvider>
        <TestConsumer />
      </UpdateProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Click Check for Updates
    await act(async () => {
      screen.getByTestId('checkBtn').click();
    });

    // React state updates from microtasks (setIsChecking(true)) flush here
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // isChecking should be true while the update check is in flight
    expect(screen.getByTestId('isChecking').textContent).toBe('true');

    // Now resolve the update check
    await act(async () => {
      resolveUpdateCheck!();
    });

    // After resolve, the 200ms settle delay runs, then setIsChecking(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByTestId('isChecking').textContent).toBe('false');
  });

  it('dismissUpdate stores the version in localStorage', async () => {
    electronAPI.updateGetState.mockResolvedValue({
      status: 'available',
      version: '0.4.0',
      releaseNotes: 'New version',
    });
    electronAPI.onUpdateState.mockReturnValue(() => {});

    render(
      <UpdateProvider>
        <TestConsumer />
      </UpdateProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100); // past auto-check timer
    });

    expect(screen.getByTestId('status').textContent).toBe('available');

    await act(async () => {
      screen.getByTestId('dismissBtn').click();
    });

    expect(localStorage.getItem('opentype:update:dismissedVersion')).toBe('0.4.0');
    expect(screen.getByTestId('isDismissed').textContent).toBe('true');
  });

  it('sets hasUpdate to true when update status is available', async () => {
    electronAPI.updateGetState.mockResolvedValue({
      status: 'available',
      version: '0.5.0',
      releaseNotes: 'Bug fixes',
    });
    electronAPI.onUpdateState.mockReturnValue(() => {});

    render(
      <UpdateProvider>
        <TestConsumer />
      </UpdateProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId('hasUpdate').textContent).toBe('true');
    expect(screen.getByTestId('status').textContent).toBe('available');
    expect(screen.getByTestId('version').textContent).toBe('0.5.0');
  });

  it('subscribes to live update events via onUpdateState', async () => {
    electronAPI.updateGetState.mockResolvedValue({ status: 'idle' });
    let emitState: (s: { status: string; version?: string }) => void;
    electronAPI.onUpdateState.mockImplementation((cb) => {
      emitState = cb;
      return () => {};
    });

    render(
      <UpdateProvider>
        <TestConsumer />
      </UpdateProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId('status').textContent).toBe('idle');

    // Simulate an update event
    await act(async () => {
      emitState!({ status: 'available', version: '0.6.0' });
    });

    expect(screen.getByTestId('status').textContent).toBe('available');
    expect(screen.getByTestId('version').textContent).toBe('0.6.0');
  });
});
