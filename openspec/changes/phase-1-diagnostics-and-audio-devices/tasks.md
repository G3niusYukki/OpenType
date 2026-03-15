## 1. Diagnostics Module - Main Process

- [x] 1.1 Create `src/main/diagnostics.ts` with DiagnosticsService class
- [x] 1.2 Implement checkMicrophonePermission() using systemPreferences API
- [x] 1.3 Implement checkAccessibilityPermission() using AppleScript
- [x] 1.4 Implement checkAutomationPermission() using AppleScript
- [x] 1.5 Implement checkFfmpeg() using execFile
- [x] 1.6 Implement checkWhisper() and checkModel() using file existence
- [x] 1.7 Implement recordFailure() and getLastFailure() methods
- [x] 1.8 Create DiagnosticsResult interface with all check statuses

## 2. Diagnostics IPC Handlers

- [x] 2.1 Add `diagnostics:run` IPC handler in `src/main/main.ts`
- [x] 2.2 Add `diagnostics:get-last-failure` IPC handler
- [x] 2.3 Add `diagnostics:request-permission` IPC handler
- [x] 2.4 Add `diagnostics:open-settings` IPC handler for opening macOS System Settings
- [x] 2.5 Add IPC types to `src/preload/preload.ts`
- [x] 2.6 Add window.electronAPI types to `src/renderer/electron.d.ts`

## 3. Diagnostics UI Components

- [x] 3.1 Create `src/renderer/components/DiagnosticsPanel.tsx` reusable component
- [x] 3.2 Create `src/renderer/pages/DiagnosticsPage.tsx` full page
- [x] 3.3 Add StatusRow component for individual check display
- [x] 3.4 Add FixAction component for permission recovery buttons
- [x] 3.5 Add LastFailureDisplay component for error history
- [x] 3.6 Add Refresh button to re-run diagnostics

## 4. Audio Device Selection - Data Layer

- [x] 4.1 Add `audioInputDevice` field to Store schema in `src/main/store.ts`
- [x] 4.2 Create `AudioInputDevice` interface with index, name, and timestamp
- [x] 4.3 Add getAudioInputDevice() method to Store class
- [x] 4.4 Add setAudioInputDevice() method to Store class
- [x] 4.5 Modify `src/main/audio-capture.ts` to accept device index parameter
- [x] 4.6 Implement device validation in audio-capture.ts
- [x] 4.7 Add fallback to default device (:0) when selected unavailable

## 5. Audio Device Selection - IPC

- [x] 5.1 Add `audio:get-devices` IPC handler in `src/main/main.ts`
- [x] 5.2 Add `audio:get-selected-device` IPC handler
- [x] 5.3 Add `audio:set-selected-device` IPC handler
- [x] 5.4 Add IPC types to `src/preload/preload.ts`
- [x] 5.5 Add window.electronAPI types to `src/renderer/electron.d.ts`

## 6. Audio Device Selection - UI

- [x] 6.1 Create `src/renderer/components/AudioDeviceSelector.tsx`
- [x] 6.2 Add device dropdown with available devices
- [x] 6.3 Add "Default Device" option at top of list
- [x] 6.4 Show currently selected device
- [x] 6.5 Add device selection section to `src/renderer/pages/SettingsPage.tsx`
- [x] 6.6 Add save confirmation indicator

## 7. Navigation Integration

- [x] 7.1 Add "Diagnostics" navigation item to `src/renderer/components/MainLayout.tsx`
- [x] 7.2 Add diagnostics route to `src/renderer/App.tsx`
- [x] 7.3 Add diagnostics icon (Activity or Stethoscope from lucide-react)
- [x] 7.4 Ensure navigation state updates correctly

## 8. Testing

- [ ] 8.1 Create unit tests for DiagnosticsService in `tests/unit/diagnostics.test.ts`
- [ ] 8.2 Create unit tests for audio device functions in `tests/unit/audio-device.test.ts`
- [ ] 8.3 Add mocks for diagnostics IPC to `tests/unit/mocks/electronAPI.ts`
- [ ] 8.4 Add mocks for audio device IPC to `tests/unit/mocks/electronAPI.ts`
- [ ] 8.5 Run `npm test` and verify all tests pass
- [ ] 8.6 Run `npm run typecheck` and verify no type errors

## 9. Build and Verification

- [ ] 9.1 Run `npm run build` to compile TypeScript
- [ ] 9.2 Start app with `npm start` and verify no runtime errors
- [ ] 9.3 Open Diagnostics page and verify all checks run
- [ ] 9.4 Open Settings and verify device selector works
- [ ] 9.5 Test device selection and verify it's used in recording
- [ ] 9.6 Verify fallback to default device when selected unavailable

## 10. Documentation

- [ ] 10.1 Update README.md with Diagnostics feature description
- [ ] 10.2 Update README.md with Audio Device Selection feature description
- [ ] 10.3 Add troubleshooting section for common permission issues
