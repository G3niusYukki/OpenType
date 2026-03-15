## Context

OpenType is an Electron-based macOS voice-to-text application using:
- **Main Process**: Node.js with TypeScript for system integration (audio capture, transcription, text insertion)
- **Renderer**: React 19 with TypeScript for UI
- **Storage**: electron-store for configuration persistence
- **Audio**: ffmpeg with AVFoundation for macOS audio capture
- **Transcription**: whisper.cpp (local) and cloud APIs (OpenAI, Groq)

### Current State

**Issue #2 - Diagnostics Gap:**
- System status is currently shown only in SettingsPage as basic indicators
- No centralized place to view all health checks
- Permission issues require users to check macOS System Settings manually
- No tracking of last failure reason

**Issue #4 - Device Selection Gap:**
- audio-capture.ts has `getAudioDevices()` method but it's not used in UI
- Device index :0 is hardcoded in ffmpeg command
- Users cannot select which microphone to use
- No persistence of device preference

### Constraints

- **macOS only** - Can use AppleScript for permission checks
- **Electron 36+** - Modern APIs available (safeStorage, etc.)
- **No new dependencies** - Use existing stack
- **Backward compatible** - Don't break existing functionality

## Goals / Non-Goals

**Goals:**
1. Create comprehensive diagnostics panel showing all system health indicators
2. Enable audio input device selection and persistence
3. Provide clear action items for failed checks
4. Maintain existing user experience for default device

**Non-Goals:**
1. Cross-platform support (Windows/Linux device enumeration)
2. Real-time device monitoring (hot-plug detection)
3. Automatic device switching when unplugged
4. Audio quality testing or calibration

## Decisions

### Decision 1: Use AppleScript for Permission Checking
**Rationale:** macOS doesn't provide direct Node.js APIs for permission status. AppleScript can query System Events for accessibility/automation permissions.

**Alternative Considered:** Use Electron's `systemPreferences.getMediaAccessStatus()` for microphone only. Rejected because we also need accessibility and automation permissions.

### Decision 2: Store Audio Device by Index
**Rationale:** ffmpeg uses device indices (:0, :1, etc.). Storing the index is straightforward and matches ffmpeg's API.

**Alternative Considered:** Store device name. Rejected because device names can change or have duplicates.

### Decision 3: Validate Device on Use, Not on Selection
**Rationale:** Devices can be unplugged between selection and use. Validating at recording start handles this gracefully.

**Fallback Strategy:** If selected device unavailable, log warning and use default (:0).

### Decision 4: Use Existing IPC Pattern
**Rationale:** Consistency with existing codebase. All main-renderer communication goes through preload.ts.

**New IPC Channels:**
- `diagnostics:run` - Run all diagnostics checks
- `diagnostics:get-last-failure` - Get last recorded failure
- `diagnostics:request-permission` - Request specific permission
- `diagnostics:open-settings` - Open macOS System Settings

### Decision 5: Reuse Existing UI Patterns
**Rationale:** Consistency with SettingsPage design. Use same card layout, status indicators, and color scheme.

**Components to Mirror:**
- StatusRow from SystemStatusPanel
- SetupHint for recovery actions
- Collapsible sections from SettingsPage

## Risks / Trade-offs

**[Risk] AppleScript permission checks may be slow (500-1000ms)**
→ Mitigation: Run checks in parallel, cache results, show loading state

**[Risk] Device index may change if devices are reconnected**
→ Mitigation: Validate index maps to expected device name before use, fallback to default

**[Risk] Diagnostics page adds maintenance burden as dependencies change**
→ Mitigation: Centralize check logic in diagnostics.ts, single place to update

**[Trade-off] Device selection UI adds complexity for simple use case**
→ Decision: Only show selector in Settings, default behavior unchanged

## Migration Plan

1. **Deploy**: New code is additive, no migration needed
2. **Device Setting**: New `audioInputDevice` field defaults to null (use :0)
3. **Rollback**: Remove new files, revert modified files - no data loss

## Open Questions

1. Should we auto-detect when selected device is unplugged and notify user?
2. Should diagnostics run automatically on app startup or only on page visit?
3. Should we add audio level meter in device selector for testing?
