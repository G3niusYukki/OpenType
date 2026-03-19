# Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-update OpenType from GitHub Releases on launch — show download progress and changelog to user, install on restart.

**Architecture:** Use `electron-updater` with GitHub provider. Main process checks for updates on `app ready`, emits events to renderer via IPC. Renderer shows a modal overlay with progress bar and release notes. Update is installed on app quit (no immediate restart).

**Tech Stack:** `electron-updater`, IPC events, React modal overlay

---

## Task 1: Install electron-updater dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add electron-updater dependency**

Run:
```bash
npm install electron-updater@latest
```

Expected: `electron-updater` added to `dependencies` in `package.json`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "dep: add electron-updater for auto-update"
```

---

## Task 2: Configure electron-builder for GitHub publishing

**Files:**
- Modify: `package.json` (build section)

- [ ] **Step 1: Add publish config to electron-builder**

Add to the `"build"` section in `package.json`:
```json
"publish": {
  "provider": "github",
  "owner": "G3niusYukki",
  "repo": "OpenType",
  "releaseType": "release"
}
```

**Important:** This tells electron-builder to generate `latest.yml` metadata file alongside each DMG, which `electron-updater` reads to find new versions.

- [ ] **Step 2: Rebuild DMG with publish config**

```bash
npm run dist:mac 2>&1 | tail -10
```

Expected: Both `.dmg` files and a `latest.yml` generated in `release/`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: configure electron-builder for GitHub auto-update"
```

---

## Task 3: Create auto-updater service

**Files:**
- Create: `src/main/auto-updater.ts`

```typescript
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

let mainWindow: BrowserWindow | null = null;
let state: UpdateState = { status: 'idle' };

function sendToRenderer(state: UpdateState) {
  mainWindow?.webContents.send('update:state', state);
}

function setState(partial: Partial<UpdateState>) {
  state = { ...state, ...partial };
  sendToRenderer(state);
}

export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setState({
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : (info.releaseNotes as any[])?.map(n => n.note).join('\n') || '',
    });
  });

  autoUpdater.on('update-not-available', () => {
    setState({ status: 'idle' });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    setState({
      status: 'downloading',
      progress: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    setState({ status: 'downloaded' });
  });

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error);
    setState({ status: 'error', error: error.message });
  });
}

export async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (error: any) {
    console.error('[AutoUpdater] Check failed:', error);
    setState({ status: 'error', error: error?.message });
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate();
  } catch (error: any) {
    console.error('[AutoUpdater] Download failed:', error);
    setState({ status: 'error', error: error?.message });
  }
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}

export function getUpdateState(): UpdateState {
  return state;
}

// IPC handlers
export function setupAutoUpdaterIpc() {
  ipcMain.handle('update:check', () => checkForUpdates());
  ipcMain.handle('update:download', () => downloadUpdate());
  ipcMain.handle('update:install', () => installUpdate());
  ipcMain.handle('update:state', () => getUpdateState());
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p src/main/tsconfig.json
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main/auto-updater.ts
git commit -m "feat: add auto-updater service with GitHub provider"
```

---

## Task 4: Wire auto-updater into main process

**Files:**
- Modify: `src/main/main.ts`

- [ ] **Step 1: Import and initialize**

Add import near the top of `main.ts`:
```typescript
import { initAutoUpdater, checkForUpdates, setupAutoUpdaterIpc } from './auto-updater';
```

In `initialize()` method, after `this.createMainWindow()` and window is available, add:
```typescript
setupAutoUpdaterIpc();
initAutoUpdater(this.mainWindow!);
checkForUpdates();
```

In `createMainWindow()` method, after `this.mainWindow = new BrowserWindow(...)`, add:
```typescript
// Check for updates after window is ready (skip in development)
this.mainWindow.webContents.on('did-finish-load', () => {
  if (process.env.NODE_ENV !== 'development') {
    checkForUpdates();
  }
});
```

**Note:** Move `checkForUpdates()` call from `initialize()` to inside `did-finish-load` to ensure window exists. Remove the earlier call if duplicate.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p src/main/tsconfig.json
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main/main.ts
git commit -m "feat: wire auto-updater into app lifecycle"
```

---

## Task 5: Add update state to preload IPC

**Files:**
- Modify: `src/preload/preload.ts`
- Modify: `src/renderer/electron.d.ts`

- [ ] **Step 1: Add to preload API**

In `src/preload/preload.ts`, add before the closing `};`:

```typescript
// Auto Update
updateCheck: () => Promise<void>;
updateDownload: () => Promise<void>;
updateInstall: () => Promise<void>;
updateGetState: () => Promise<{
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}>;
onUpdateState: (callback: (state: any) => void) => () => void;
```

Add implementations:
```typescript
updateCheck: () => ipcRenderer.invoke('update:check'),
updateDownload: () => ipcRenderer.invoke('update:download'),
updateInstall: () => ipcRenderer.invoke('update:install'),
updateGetState: () => ipcRenderer.invoke('update:state'),
onUpdateState: (callback: (state: any) => void) => {
  const handler = (_: unknown, state: any) => callback(state);
  ipcRenderer.on('update:state', handler);
  return () => ipcRenderer.off('update:state', handler);
},
```

- [ ] **Step 2: Add to electron.d.ts types**

In `src/renderer/electron.d.ts`, add inside `Window['electronAPI']` before `};`:

```typescript
// Auto Update
updateCheck: () => Promise<void>;
updateDownload: () => Promise<void>;
updateInstall: () => Promise<void>;
updateGetState: () => Promise<{
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}>;
onUpdateState: (callback: (state: any) => void) => () => void;
```

- [ ] **Step 3: Type-check both**

```bash
npx tsc --noEmit -p src/main/tsconfig.json && npx tsc --noEmit -p src/renderer/tsconfig.json
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/preload/preload.ts src/renderer/electron.d.ts
git commit -m "feat: expose auto-update IPC to renderer"
```

---

## Task 6: Create Update Available modal component

**Files:**
- Create: `src/renderer/components/UpdateModal.tsx`

```tsx
import { useState, useEffect } from 'react';

interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

export function UpdateModal() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Get initial state
    window.electronAPI.updateGetState().then(s => {
      setState(s);
      if (s.status === 'available' || s.status === 'downloading' || s.status === 'downloaded') {
        setVisible(true);
      }
    });

    // Subscribe to updates
    const unsub = window.electronAPI.onUpdateState((s: UpdateState) => {
      setState(s);
      if (s.status === 'available' || s.status === 'downloading' || s.status === 'downloaded') {
        setVisible(true);
      }
    });

    return unsub;
  }, []);

  if (!visible) return null;

  const handleDownload = () => window.electronAPI.updateDownload();
  const handleInstall = () => window.electronAPI.updateInstall();
  const handleDismiss = () => setVisible(false);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '480px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {state.status === 'checking' && (
          <>
            <h2 style={{ color: '#fff', marginTop: 0 }}>Checking for updates...</h2>
            <div style={{ color: '#666', fontSize: '14px' }}>Please wait</div>
          </>
        )}

        {state.status === 'available' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                Update Available
              </span>
              <span style={{ color: '#818cf8', fontSize: '14px' }}>v{state.version}</span>
            </div>
            <h2 style={{ color: '#fff', marginTop: 0 }}>OpenType {state.version} is ready!</h2>
            <div style={{ color: '#888', fontSize: '14px', marginBottom: '20px', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {state.releaseNotes || 'New version with improvements.'}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleDismiss} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#222',
                color: '#999',
                fontSize: '14px',
                cursor: 'pointer',
              }}>
                Later
              </button>
              <button onClick={handleDownload} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#6366f1',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}>
                Download & Install
              </button>
            </div>
          </>
        )}

        {state.status === 'downloading' && (
          <>
            <h2 style={{ color: '#fff', marginTop: 0 }}>Downloading update...</h2>
            <div style={{ margin: '20px 0' }}>
              <div style={{
                height: '8px',
                background: '#2a2a2a',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${state.progress || 0}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ color: '#666', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>
                {state.progress}% downloaded
              </div>
            </div>
          </>
        )}

        {state.status === 'downloaded' && (
          <>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', marginTop: 0 }}>Update Ready!</h2>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>
              OpenType will restart to apply the update.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleDismiss} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#222',
                color: '#999',
                fontSize: '14px',
                cursor: 'pointer',
              }}>
                Restart Later
              </button>
              <button onClick={handleInstall} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#22c55e',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}>
                Restart Now
              </button>
            </div>
          </>
        )}

        {state.status === 'error' && (
          <>
            <h2 style={{ color: '#ef4444', marginTop: 0 }}>Update Error</h2>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>
              {state.error || 'Failed to check for updates.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleDismiss} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: '#222',
                color: '#999',
                fontSize: '14px',
                cursor: 'pointer',
              }}>
                Dismiss
              </button>
              <button onClick={() => window.electronAPI.updateCheck()} style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#6366f1',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}>
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/UpdateModal.tsx
git commit -m "feat: add update available modal component"
```

---

## Task 7: Integrate UpdateModal into app shell

**Files:**
- Modify: `src/renderer/App.tsx` (or wherever the root component is)

- [ ] **Step 1: Add UpdateModal to root**

Find the root React component (likely `App.tsx` or `index.tsx`). Add import and render:

```tsx
import { UpdateModal } from './components/UpdateModal';

// In the root component's JSX, add at the very bottom:
<UpdateModal />
```

**Note:** If the app uses React Router, add it to the layout component that wraps all routes (so it persists across navigation).

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: integrate UpdateModal into app root"
```

---

## Task 8: Add update translations

**Files:**
- Modify: `src/renderer/i18n/translations.ts`

- [ ] **Step 1: Add update-related translation keys**

In `Translations` interface, add:
```typescript
update: {
  checking: string;
  available: string;
  downloading: string;
  downloaded: string;
  error: string;
  downloadNow: string;
  installNow: string;
  later: string;
  restartLater: string;
  restartNow: string;
  dismissed: string;
};
```

Add to `en`, `zh`, `ja`, `ko` objects with appropriate translations.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p src/renderer/tsconfig.json
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/i18n/translations.ts
git commit -m "i18n: add update modal translation strings"
```

---

## Task 9: Update CHANGELOG and rebuild

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add auto-update to CHANGELOG**

In the `[Unreleased]` section of `CHANGELOG.md`, add:
```markdown
- **Auto-Update**: Automatically checks for updates from GitHub Releases on launch. Shows download progress and release notes, installs on restart.
```

- [ ] **Step 2: Build and verify**

```bash
npm run build && npm run typecheck
```

Expected: All builds pass, no type errors

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "feat: add auto-update from GitHub Releases"
```

---

## Task 10: Build DMG and upload to release

- [ ] **Step 1: Build DMG with electron-builder publish config**

```bash
npm run dist:mac 2>&1 | tail -15
```

Expected: DMG files + `latest.yml` in `release/`

- [ ] **Step 2: Verify latest.yml exists**

```bash
cat release/latest.yml
```

Expected: Contains `version`, `path` (to DMG), and `sha512`

- [ ] **Step 3: Upload to GitHub release**

```bash
gh release upload v0.3.0 \
  release/OpenType-0.3.0.dmg \
  release/OpenType-0.3.0-arm64.dmg \
  release/latest.yml \
  --clobber
```

- [ ] **Step 4: Verify release assets**

```bash
gh release view v0.3.0 --json assets --jq '.assets[].name'
```

Expected: Lists all 3 files

---

## Verification

1. **Dev mode**: `npm run dev` — should log "update check skipped in development" (or just no error)
2. **Simulate update**: Temporarily add a fake version check by patching `latest.yml` with a higher version number and running the built app
3. **Build test**: `npm run build && npm run typecheck` — no errors
4. **Release test**: `gh release view v0.3.0` shows `latest.yml` asset
