# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

OpenType is a native macOS menu bar voice-to-text app (Swift 5.9 + AppKit + SwiftUI, macOS 13+). It captures voice via global hotkeys, transcribes through pluggable providers (Apple Speech on-device, OpenAI Whisper, Groq, Aliyun/Baidu/Tencent/iFlytek/WhisperCPP), optionally polishes output through pluggable AI providers (OpenAI, Anthropic, DeepSeek, Zhipu, MiniMax, Moonshot, Groq), and inserts the result into the focused app via Accessibility API / CGEvent / AppleScript / clipboard fallback. The legacy Electron app lives on the `electron` branch — the primary branch is the native Swift rewrite only.

The current `main` version is **1.2.0** (per `CHANGELOG.md`); the value `0.9.0` still in `Constants.appVersion` and the value `0.9.1` in `project.yml` are out of sync and should be bumped in the same change that touches versioning.

## Common commands

The Swift package lives in `OpenType/`. All build/test commands run from that subdirectory.

```bash
# Build (debug)
cd OpenType
swift build

# Build (release — what CI's release job uses)
swift build -c release

# Run all unit tests
swift test

# Run a single test by class name
swift test --filter HistoryStoreTests

# Run a single test method
swift test --filter HistoryStoreTests/testInsertAndFetch

# Generate / regenerate the Xcode project (uses XcodeGen, project.yml)
brew install xcodegen
cd OpenType
xcodegen generate
open OpenType.xcodeproj

# Lint (CI runs this with --strict; brew install is part of the workflow)
brew install swiftformat
swiftformat --lint OpenType/Sources OpenType/Tests
```

The Xcode project is generated — never edit `OpenType.xcodeproj` by hand. Edit `OpenType/project.yml` and rerun `xcodegen generate`.

The DMG release artifact is produced by the `release` job in `.github/workflows/build-swift.yml` (only on `v*` tag pushes). It expects the bundle ID `com.opentype.macos`, hardcoded ad-hoc signing (`CODE_SIGN_IDENTITY: "-"`), and LSUIElement (no Dock icon).

## Module architecture

The package (`OpenType/Package.swift`) is split into strict layers — circular dependencies are explicitly prevented by the dependency graph in `CONTRIBUTING.md`. The graph is, top-down:

- `Models` — Foundation value types only (no deps). `VoiceMode`, `HistoryEntry`, `TranscriptionResult`, `Profile`, `StyleProfile`, `DictionaryEntry`, `EditCommand`, `SmartSuggestion`, `PromptPreset`, `DiagnosticResult`.
- `Utilities` — `Constants` (hotkey key codes, default suite name `com.opentype.macos`, UI window sizes), `PermissionService`, `RetryPolicy`, `SSEParser`, `EditCommandDetector`, `UserDefault` property wrapper.
- `Data` — Persistence: `SettingsStore` (UserDefaults via the `com.opentype.macos` suite), `HistoryStore` (SQLite.swift, holds history + style profiles/examples/tone rules tables), `StyleStore` (extracted in 1.1.0 for style CRUD), `DictionaryStore`, `ProfileStore`, `PromptPresetStore`, `KeychainManager`, `HotkeyConfig`, `VoiceModeConfig`, `AppProfileBinding`.
- `Providers` — Pluggable backends behind protocols. `Providers/ProviderHTTPClient.swift` defines the shared `ProviderHTTPClient` protocol, `ChatCompletionRequest`/`ChatCompletionResponse` types, and helpers `performJSONPost` + `performMultipartUpload` that all 8 transcription and 7 AI providers use. `Providers/AI/AIProvider.swift` defines the `AIProvider` protocol and `AIProviderFactory` (provider name → actor). `Providers/Transcription/TranscriptionProvider.swift` defines the symmetric protocol.
- `Services` — Business logic orchestration: `RecordingCoordinator` (audio + realtime transcription + VAD lifecycle — extracted from `PopoverViewModel` in 1.0.0), `AudioCaptureService` (singleton, with `AudioDeviceWatcher` for hot-swap), `RealtimeTranscriptionService` (feeds `SFSpeechAudioBufferRecognitionRequest` for live partials), `VADDetector` (adaptive silence threshold ~1.2s), `TranscriptionService`, `AIProcessingService` (singleton, retry + provider failover + streaming), `StyleProfileService` (builds prompts with token budget 500 instruction / 800 example), `DictionaryService`, `TextInsertionService` + `ClipboardGuard` + `TextInsertionError` (typed errors, AX direct injection preferred), `HotkeyService` (singleton), `ProviderFailover`, `HealthMonitor` (2-min interval, >200MB memory threshold, >5min stale recording), `NotificationService`, `ProfileService`, `DiagnosticsService`, `MigrationService` (from legacy Electron at `~/Library/Application Support/OpenType/`).
- `OpenTypeUI` (under `Sources/UI`) — All SwiftUI views and `NSWindowController`s. `UI/StatusBar/StatusBarController` + `StatusBarIcon` (dynamic states: gray idle / red recording / blue spinner processing / orange error with 3s revert), `UI/Popover/PopoverView` + `PopoverViewModel` + `RecordingControlsView` + `TranscriptionResultView` + `QuickAnswerView` + `AudioLevelIndicator`, `UI/Windows/{Settings,Main,Diagnostics,Onboarding}WindowController`.
- `App` — The executable target. `main.swift` + `AppDelegate` (crash recovery cleanup of stale recordings, first-launch onboarding, Sparkle `SPUStandardUpdaterController` setup, `HealthMonitor.startMonitoring()`). Entry point.

## Big-picture flows to keep in mind

**Recording flow:** Hotkey press → `HotkeyService` → `AppDelegate` event → `PopoverViewModel.startRecording(mode:)` → `RecordingCoordinator.start()` → `AudioCaptureService.startRecording()` + `RealtimeTranscriptionService.start()` (writes `liveText` via Combine) + `VADDetector` watches levels. On VAD pause or release → `TranscriptionService.transcribe()` → `AIProcessingService.process()` (with retry + cascading failover across 7 AI providers, prompt built by `StyleProfileService`) → `TextInsertionService` (AX → CGEvent paste → AppleScript → clipboard, with `ClipboardGuard` saving/restoring the pasteboard) → write to `HistoryStore`.

**Provider selection is dynamic, not snapshotted.** Both `AIProcessingService` and `TranscriptionService` re-read `SettingsStore.shared.selectedAIProvider` / `selectedTranscriptionProvider` on every call — do not cache the provider across calls.

**Streaming:** `AIProvider.processStreaming()` returns `AsyncThrowingStream<String, Error>`. OpenAI provider uses Server-Sent Events (`SSEParser` in Utilities). Other providers fall back to a single-shot via the protocol's default extension.

**Per-app tone:** `StyleProfileService.buildSystemPrompt(appBundleID:)` looks up per-app tone rules from `StyleStore` (table `app_tone_rules`) and prepends them to the global style prompt. The active `appBundleID` is the focused app at recording time.

**Crash recovery:** `AppDelegate.applicationDidFinishLaunching` checks `UserDefaults.bool(forKey: "isRecordingActive")` — if true, the previous session died mid-recording; it cleans temp audio files and resets the flag before the new session starts.

**State management conventions:** All view models and UI services are `@MainActor`. Provider implementations are `actor` for thread-safety, with `@unchecked Sendable` on cross-actor singletons. `@Published` drives SwiftUI reactivity; `RecordingCoordinator` uses `assign(to:)` to mirror its state into `PopoverViewModel` so the view model stays thin.

## Coding standards (enforced)

- Swift 5.9+, strict concurrency where possible. Mark cross-module types `public` explicitly.
- Use `actor` for thread-safe providers; `@MainActor` for UI-bound services and view models; `@unchecked Sendable` for safe singleton services.
- Typed errors via `enum FooError: Error, LocalizedError` with `errorDescription` — see `TextInsertionError` and `TranscriptionError` for the pattern. Don't throw bare `Error`.
- Conventional commits: `feat(scope):`, `fix(scope):`, `docs(scope):`, `refactor(scope):`. The package `scope` is the module name (e.g. `feat(transcription):`, `fix(popover):`).
- Bump version in three places when releasing: `CHANGELOG.md` (new top entry), `OpenType/project.yml` `CFBundleShortVersionString`, and `OpenType/Sources/Utilities/Constants.swift` `appVersion`. Currently these disagree (1.2.0 / 0.9.1 / 0.9.0) — they should be reconciled in a version-bump commit.

## Testing

`OpenType/Tests/` is XCTest, all under the `OpenTypeTests` target. Currently 126 tests across services, models, data, and provider integration. Notable patterns:

- Provider tests use `ProviderIntegrationTests` to verify the factory (`AIProviderFactory` / `TranscriptionProviderFactory`) returns unique-named, correctly-typed instances for every registered provider name.
- Security tests (`AutoLearningSecurityTests`, `BoundaryErrorPathTests`) cover malformed JSON, missing keys, empty content, XSS, and Unicode — `AIError` messages must not leak sensitive data.
- `ProviderHTTPClient` deduplication means providers are tested against the shared helpers, not just per-provider HTTP code.
- Tests assume the same `swift test` invocation CI uses — don't suppress stderr in test commands (CI removed the `2>/dev/null` swallow in 0.9.1).

## Other notable paths

- `OpenType/Resources/Info.plist`, `OpenType/Resources/OpenType.entitlements` — `LSUIElement: true` (menu bar app, no Dock icon), mic + speech recognition usage strings, hardened runtime on, ad-hoc signed. Entitlements request microphone + audio-input + AppleEvents automation.
- `OpenType/Resources/appcast.xml` — Sparkle update feed; release notes are pulled from `RELEASE.md` by the `release` job in CI.
- `Shared/` — work-in-progress cross-platform extraction (`OpenTypeCore`, `OpenTypeData`, `OpenTypeModels`, `OpenTypeProviders`); not yet wired into the `OpenType/Package.swift` build. Don't add to it without confirming the package graph still compiles standalone.
- `OpenType-iOS/` — stub iOS port with `App/`, `KeyboardExtension/`, `UI/` directories and a README declaring it planned. Not built by CI.
- `deprecated/` — legacy Electron code (also kept on the `electron` branch).
- `openspec/` — OpenSpec change-management artifacts (config + spec deltas + active changes). The `.claude/skills/openspec-*` skills wrap this workflow.
- `.claude/`, `.omc/`, `.superpowers/`, `.sisyphus/`, `.worktrees/` — local tool state; ignored by git.
- `IMPROVEMENT_PLAN.md` — 5-phase quality-first roadmap (Quality Foundation → Architecture Refactor → Testing Depth → Feature Parity → Production Hardening). CHANGELOG tracks progress per phase.

## Things that are easy to get wrong

- Don't bypass the `ProviderHTTPClient` protocol when adding a new provider — copy the pattern from `OpenAIWhisperProvider` (refactored to 50 lines in 1.2.0 as the reference) or `OpenAIProvider`. Hand-rolled multipart/JSON is what was deduplicated away.
- The `AIProvider.translate()` default delegates to `process()` — only override it if the provider has a dedicated translation endpoint.
- `LSUIElement: true` means there's no Dock icon by design. Don't "fix" the missing window.
- `SettingsStore` uses the `com.opentype.macos` UserDefaults suite, not `.standard`. The `Constants.UserDefaults.suiteName` constant is the source of truth.
- API keys live in the Keychain via `KeychainManager`, never in UserDefaults. The `Keychain.service` constant is `com.opentype.macos`.
- `PopoverViewModel` is intentionally thin after 1.0.0 — recording lifecycle lives in `RecordingCoordinator`; new recording-related logic goes there, not in the view model.
