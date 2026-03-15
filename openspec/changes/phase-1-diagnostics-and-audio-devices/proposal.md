## Why

OpenType users currently lack visibility into why the app fails to record or transcribe. When issues occur, users must infer causes from logs or trial-and-error. Additionally, users with multiple microphones cannot select which device OpenType records from, leading to confusion when the wrong source is used. This phase addresses both issues by adding a comprehensive diagnostics panel and audio device selection capability.

## What Changes

### Issue #2 - Diagnostics Panel
- **New**: DiagnosticsPage showing comprehensive system health status
  - Microphone permission status with request action
  - Accessibility permission status with instructions
  - Automation permission status with instructions
  - ffmpeg availability check
  - whisper.cpp installation check
  - Whisper model availability check
  - Active transcription provider status
  - Last failure reason tracking
- **New**: Reusable DiagnosticsPanel component for embedding in other pages
- **New**: Navigation item in MainLayout for accessing DiagnosticsPage
- **New**: IPC handlers for permission checking and diagnostics data

### Issue #4 - Audio Input Device Selection
- **New**: AudioDeviceSelector component in SettingsPage
- **New**: audioInputDevice setting in electron-store schema
- **Modified**: audio-capture.ts to use selected device instead of hardcoded :0
- **New**: Device validation and fallback to default if selected device unavailable
- **New**: Visual indicator showing currently active device

## Capabilities

### New Capabilities
- `diagnostics-panel`: System health diagnostics and permission checking
- `audio-device-selection`: Audio input device enumeration and selection

### Modified Capabilities
- None (no existing spec-level behavior changes)

## Impact

**Code Changes:**
- New files: `src/main/diagnostics.ts`, `src/renderer/pages/DiagnosticsPage.tsx`, `src/renderer/components/DiagnosticsPanel.tsx`, `src/renderer/components/AudioDeviceSelector.tsx`
- Modified: `src/main/store.ts`, `src/main/audio-capture.ts`, `src/main/main.ts`, `src/preload/preload.ts`, `src/renderer/App.tsx`, `src/renderer/components/MainLayout.tsx`, `src/renderer/pages/SettingsPage.tsx`

**API Changes:**
- New IPC channels: `diagnostics:run`, `diagnostics:get-last-failure`, `diagnostics:request-permission`, `diagnostics:open-settings`
- New store field: `audioInputDevice` with device index and name

**Dependencies:**
- No new dependencies required

**User Impact:**
- Users can now diagnose setup issues via Diagnostics page
- Users can select preferred microphone in Settings
- Existing functionality unchanged (backward compatible)
