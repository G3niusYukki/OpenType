import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

export interface UpdateContextValue {
  hasUpdate: boolean;
  updateInfo: UpdateState | null;
  isChecking: boolean;
  error: string | null;
  isDismissed: boolean;
  checkUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

const DISMISSED_VERSION_KEY = 'opentype:update:dismissedVersion';

const UpdateContext = createContext<UpdateContextValue | undefined>(undefined);

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [updateInfo, setUpdateInfo] = useState<UpdateState | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Keep a ref so checkUpdate doesn't need to be a dep of the auto-check effect
  const checkUpdateRef = useRef<(() => Promise<void>) | null>(null);

  // Determine hasUpdate based on current updateInfo status
  const hasUpdate =
    updateInfo?.status === 'available' ||
    updateInfo?.status === 'downloading' ||
    updateInfo?.status === 'downloaded';

  // Sync isDismissed with localStorage whenever the available version changes
  useEffect(() => {
    const available = updateInfo?.status === 'available' ? updateInfo.version : null;
    if (!available) return;
    const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY);
    setIsDismissed(dismissedVersion === available);
  }, [updateInfo?.status, updateInfo?.version]);

  // Subscribe to live update state from the main process
  useEffect(() => {
    let active = true;

    window.electronAPI.updateGetState().then((state) => {
      if (active) setUpdateInfo(state);
    });

    const unsub = window.electronAPI.onUpdateState((state: UpdateState) => {
      if (active) setUpdateInfo(state);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const checkUpdate = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      // Start the check; the onUpdateState listener above will update state as events arrive.
      await window.electronAPI.updateCheck();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsChecking(false);
      return;
    }

    // Wait briefly for the event stream to settle so callers see a stable result.
    await new Promise((resolve) => setTimeout(resolve, 200));
    setIsChecking(false);
  }, []);

  // Store the stable reference so the effect below always calls the latest version
  checkUpdateRef.current = checkUpdate;

  // Auto-check 1 second after mount (matches cc-switch pattern)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkUpdateRef.current?.();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const dismissUpdate = useCallback(() => {
    const version = updateInfo?.status === 'available' ? updateInfo.version : null;
    if (version) {
      localStorage.setItem(DISMISSED_VERSION_KEY, version);
    }
    setIsDismissed(true);
  }, [updateInfo]);

  const value: UpdateContextValue = {
    hasUpdate,
    updateInfo,
    isChecking,
    error,
    isDismissed,
    checkUpdate,
    dismissUpdate,
  };

  return (
    <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
  );
}

export function useUpdate(): UpdateContextValue {
  const context = useContext(UpdateContext);
  if (!context) {
    // Graceful fallback: return a no-op default so components work outside the provider
    // (e.g. in existing tests). In the actual app, UpdateProvider wraps the full App.
    return {
      hasUpdate: false,
      updateInfo: null,
      isChecking: false,
      error: null,
      isDismissed: false,
      checkUpdate: async () => {},
      dismissUpdate: () => {},
    };
  }
  return context;
}
