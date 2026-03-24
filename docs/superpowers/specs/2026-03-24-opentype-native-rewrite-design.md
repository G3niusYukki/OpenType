# OpenType macOS Native Rewrite — Design Document

**Date:** 2026-03-24
**Author:** OpenType Team
**Status:** Approved

## 1. Overview

Rewrite the existing Electron-based OpenType app as a native macOS application using **Swift + AppKit + SwiftUI hybrid** approach. The goal is to eliminate Electron's overhead while preserving all existing functionality:

- Voice-to-text dictation with AI post-processing
- Four voice input modes (basic, hands-free, translate, edit selected)
- Multi-provider transcription (local + cloud)
- Multi-provider AI post-processing
- Menu bar app with global hotkeys
- Text insertion into any application

## 2. Technology Stack

### Core Technologies
- **Language:** Swift 5.9+
- **UI Framework:** Hybrid AppKit + SwiftUI
  - AppKit: System-level features (NSStatusItem, NSWindow, NSMenu, NSTask)
  - SwiftUI: All application UI (Popover, Windows, Settings, History, etc.)
- **Build Tool:** Xcode 15+ (Swift Package Manager for dependencies)
- **Minimum macOS Version:** macOS 13.0 (Ventura)

### Key Dependencies (Swift Package Manager)
| Package | Purpose |
|---------|---------|
| SQLite.swift | Structured data storage |
| Sparkle | Auto-update framework |
| KeychainAccess | Simplified Keychain API |

### Native Frameworks Used
| Framework | Purpose |
|-----------|---------|
| AVFoundation | Audio recording |
| Speech | On-device transcription (SFSpeechRecognizer) |
| CoreGraphics | CGEventTap for global hotkeys |
| ApplicationServices | AXUIElement for accessibility |
| Security | Keychain Services for API key storage |
| AppKit | System integration |

## 3. Architecture

```
OpenType/
├── App/
│   ├── main.swift                    # Manual app entry point (no @main)
│   ├── AppDelegate.swift             # App lifecycle, menu bar setup
│   └── Info.plist                    # LSUIElement=true (no Dock icon)
│
├── UI/
│   ├── StatusBar/
│   │   └── StatusBarController.swift  # NSStatusItem + icon management
│   ├── Popover/
│   │   ├── PopoverView.swift         # SwiftUI Popover main view
│   │   ├── RecordingView.swift      # Recording controls
│   │   └── TranscriptionResultView.swift
│   ├── Windows/
│   │   ├── MainWindowController.swift  # History/Dictionary/Profiles
│   │   ├── SettingsWindowController.swift # Settings window
│   │   ├── DiagnosticsWindowController.swift
│   │   └── Views/
│   │       ├── HistoryView.swift
│   │       ├── DictionaryView.swift
│   │       ├── ProfilesView.swift
│   │       ├── SettingsView.swift     # 5 tabs
│   │       └── DiagnosticsView.swift
│   └── Components/
│       └── (shared SwiftUI components)
│
├── Services/
│   ├── AudioCaptureService.swift     # AVAudioEngine recording
│   ├── TranscriptionService.swift    # SFSpeechRecognizer + cloud APIs
│   ├── AIProcessingService.swift     # AI post-processing HTTP client
│   ├── TextInsertionService.swift    # CGEvent paste + clipboard fallback
│   ├── HotkeyService.swift           # CGEventTap global hotkeys
│   └── DiagnosticsService.swift      # System health checks
│
├── Providers/
│   ├── Transcription/
│   │   ├── TranscriptionProvider.swift  # Protocol
│   │   ├── AppleSpeechProvider.swift    # SFSpeechRecognizer
│   │   ├── OpenAIWhisperProvider.swift
│   │   ├── GroqTranscriptionProvider.swift
│   │   ├── AlibabaProvider.swift
│   │   ├── TencentProvider.swift
│   │   ├── BaiduProvider.swift
│   │   └── iFlytekProvider.swift
│   └── AI/
│       ├── AIProvider.swift          # Protocol
│       ├── OpenAIProvider.swift
│       ├── AnthropicProvider.swift
│       ├── DeepSeekProvider.swift
│       ├── ZhipuProvider.swift
│       ├── MiniMaxProvider.swift
│       ├── MoonshotProvider.swift
│       └── GroqAIProvider.swift
│
├── Models/
│   ├── TranscriptionResult.swift
│   ├── VoiceMode.swift
│   ├── Profile.swift
│   └── HistoryEntry.swift
│
├── Data/
│   ├── SettingsStore.swift           # UserDefaults wrapper
│   ├── HistoryStore.swift            # SQLite.swift
│   ├── DictionaryStore.swift         # SQLite.swift
│   └── KeychainManager.swift         # Keychain Services wrapper
│
├── Utilities/
│   ├── Constants.swift
│   └── Extensions.swift
│
└── Resources/
    ├── Assets.xcassets
    ├── entitlements.mac.plist
    └── OpenType.entitlements
```

## 4. Application Lifecycle

### App Startup
1. `main.swift` calls `NSApplication.shared.run()`
2. `AppDelegate.applicationDidFinishLaunching`:
   - Request necessary permissions (microphone, accessibility)
   - Initialize services (HotkeyService, AudioCaptureService)
   - Setup NSStatusItem with icon
   - Restore last state from UserDefaults

### LSUIElement (No Dock Icon)
- Set `LSUIElement = true` in Info.plist
- App does not appear in Dock
- Managed entirely from Menu Bar

## 5. UI Architecture

### 5.1 Menu Bar Icon (NSStatusItem)
- Persistent status bar icon showing current state:
  - Idle: microphone icon
  - Recording: animated red dot
  - Processing: spinner
  - Error: exclamation mark

### 5.2 Popover (SwiftUI)
**Triggered by:** Click on menu bar icon

**Content:**
- Quick recording controls (start/stop for each mode)
- Current transcription result
- Quick access to last 5 history items
- "Open Settings" / "Open History" buttons

**Size:** 320pt × 400pt (fixed)

### 5.3 Main Window (NSWindow + SwiftUI)
**Triggered by:** "Open Main Window" from Popover or menu

**Tabs:**
- History tab — list of past transcriptions with playback
- Dictionary tab — manage custom vocabulary
- Profiles tab — manage configuration profiles

**Size:** 600pt × 500pt (resizable)

### 5.4 Settings Window (NSWindow + SwiftUI)
**Triggered by:** "Settings..." menu item or gear icon

**Tabs:**
1. **General** — Launch at login, hotkey config, notifications
2. **Transcription** — Provider selection, API keys, local settings
3. **AI** — AI provider selection, API keys, prompt templates
4. **Voice Modes** — Configure each of the 4 modes
5. **Data** — Export/import, clear history, cache

**Size:** 650pt × 550pt (fixed)

### 5.5 Diagnostics Window (NSWindow + SwiftUI)
**Triggered by:** Debug menu or settings diagnostics tab

**Content:**
- System health check results
- Permission status (microphone, accessibility)
- Audio device detection
- Network connectivity tests
- FFmpeg availability (if whisper.cpp local used)

**Size:** 500pt × 400pt

## 6. Core Services

### 6.1 AudioCaptureService
```
Responsibility: Record audio from microphone
Implementation: AVAudioEngine + AVAudioSession
Output: 16kHz WAV file saved to temp directory
States: idle → recording → stopped
```

**Key APIs:**
```swift
func startRecording() throws
func stopRecording() -> URL
func getAudioLevel() -> Float  // for UI level meter
```

### 6.2 TranscriptionService
```
Responsibility: Convert audio to text
Primary: SFSpeechRecognizer (Apple Speech Framework)
Fallback: Cloud transcription providers (OpenAI, Groq, Alibaba, etc.)
```

**Key APIs:**
```swift
func transcribe(audioURL: URL, provider: TranscriptionProvider) async throws -> TranscriptionResult
func getAvailableProviders() -> [TranscriptionProvider]
```

**Provider Resolution:**
1. Check user preference for local vs cloud
2. If local: use Apple Speech Framework
3. If cloud: use selected provider (API key from Keychain)

### 6.3 AIProcessingService
```
Responsibility: Post-process transcribed text
Providers: OpenAI GPT, Anthropic Claude, DeepSeek, Zhipu GLM, MiniMax, Moonshot, Groq
```

**Key APIs:**
```swift
func process(text: String, provider: AIProvider) async throws -> String
func removeFillers(_ text: String) async throws -> String
func translate(text: String, from: String, to: String) async throws -> String
```

### 6.4 TextInsertionService
```
Responsibility: Insert text at cursor position and read selected text in target app
Strategy:
  1. CGEvent: Simulate Cmd+V keypress (requires Accessibility permission)
  2. Fallback: AppleScript osascript (requires Automation permission)

Edit Selected Mode:
  1. AXUIElement: Read selected text from frontmost app via AXUIElementCopySelectedText
  2. Fallback: Read from clipboard (user must copy selection beforehand)
```

**Key APIs:**
```swift
func insertText(_ text: String) throws
func getSelectedText() -> String?  // for Edit Selected mode
func hasAccessibilityPermission() -> Bool
func requestAccessibilityPermission()
```

### 6.5 HotkeyService
```
Responsibility: Register and handle global keyboard shortcuts
Implementation: CGEventTap on kCGHIDEventTap
```

**Default Hotkeys (configurable):**
| Mode | Default Hotkey |
|------|----------------|
| Basic Voice Input | ⌘⇧D |
| Hands-Free Toggle | ⌘⇧Space (avoids Spotlight conflict) |
| Translate | ⌘⇧T |
| Edit Selected | ⌘⇧E |

**Hotkey conflict resolution:** On hotkey registration failure (another app claimed the shortcut), show a user-facing alert in Settings → General explaining which hotkey is unavailable and offering a way to reconfigure. The app does not steal shortcuts from other apps — it only registers if the system allows it.

**Key APIs:**
```swift
func registerHotkey(keyCode: CGKeyCode, modifiers: CGEventFlags, handler: () -> Void)
func unregisterAll()
```

## 7. Data Storage

### 7.1 UserDefaults (SettingsStore)
**Stored items:**
- Selected transcription provider
- Selected AI provider
- Hotkey configurations
- Launch at login preference
- Notification preferences
- Theme preference
- Last used profile ID

### 7.2 SQLite.swift (HistoryStore)
**Table: history**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| audio_path | TEXT | Path to recorded audio file |
| original_text | TEXT | Raw transcription |
| processed_text | TEXT | After AI post-processing |
| mode | TEXT | Voice input mode used |
| provider | TEXT | Transcription provider |
| created_at | INTEGER | Unix timestamp |
| duration | REAL | Recording duration in seconds |
| language | TEXT | Detected/spoken language |

**Table: dictionary**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| term | TEXT | Custom term |
| replacement | TEXT | Replacement text |
| category | TEXT | Category/tag |

### 7.3 Keychain Services (KeychainManager)
**Stored items (per provider):**
- API keys for each transcription provider
- API keys for each AI provider

**Keychain service name:** `com.opentype.macos`

## 8. Permissions & Entitlements

### Info.plist Keys
```xml
NSMicrophoneUsageDescription: "OpenType needs microphone access to record your voice for transcription."
NSSpeechRecognitionUsageDescription: "OpenType uses speech recognition to transcribe your voice."
```

### Entitlements (OpenType.entitlements)
```xml
com.apple.security.device.microphone: true
com.apple.security.device.audio-input: true
com.apple.security.automation.apple-events: true
```

### Runtime Permission Requests
1. **Microphone** — Requested on first recording attempt via AVAudioSession
2. **Speech Recognition** — Requested on first transcription via SFSpeechRecognizer
3. **Accessibility** — Required for CGEvent (hotkeys + text insertion). Requested once, persisted by system.

## 9. Voice Input Modes

| Mode | Behavior | Hotkey |
|------|----------|--------|
| **Basic** | Hold hotkey → record → release → process → insert | ⌘⇧D |
| **Hands-Free** | Toggle hotkey → record → toggle again → process → insert | ⌘⇧Space |
| **Translate** | Hold hotkey → record → translate → insert English | ⌘⇧T |
| **Edit Selected** | Select text in target app → hold hotkey → record → replace selected text | ⌘⇧E |

**Translate mode — source language:** Auto-detected from spoken language (via SFSpeechRecognizer locale). Supported source languages: Chinese (Mandarin), English, Japanese, Korean, French, German, Spanish, and any language SFSpeechRecognizer supports. User can optionally lock to a specific source language in Voice Modes settings tab.

**Edit Selected mode — read selected text:** Uses AXUIElement to read the currently selected text from the frontmost application. Requires Accessibility permission. On AXUIElement failure (e.g., app doesn't support accessibility API), falls back to reading clipboard content (user must manually copy selection before activating).

## 10. Auto-Update (Sparkle)

**Configuration:**
- Update channel: stable
- Feed URL: `https://github.com/G3niusYukki/OpenType/releases/feed.xml`
- Sparkle certificate for code signing

**Update behavior:**
- Check for updates on app launch (configurable)
- Manual check from Settings > General
- Download in background, prompt to restart

## 11. Error Handling

| Error Type | User Feedback | Recovery |
|-----------|---------------|----------|
| Microphone permission denied | Alert with System Preferences link | Open Privacy settings |
| Accessibility permission denied | Alert with System Preferences link | Open Accessibility settings |
| Transcription failed | Inline error in Popover | Retry button |
| AI processing failed | Inline error in Popover | Retry with fallback provider |
| Text insertion failed | Notification + copy to clipboard | Manual paste from clipboard |
| Network unavailable | Notification | Queue for retry when online |

## 12. Testing Strategy

### Unit Tests
- Service layer (mocked providers)
- Data layer (in-memory SQLite)
- Model serialization/deserialization

### Integration Tests
- Full transcription pipeline (record → transcribe → AI → insert)
- Settings persistence
- History CRUD

### UI Tests
- SwiftUI view hierarchy tests
- Keyboard shortcut handling
- Window lifecycle

## 13. Migration from Electron

**Data migration:**
- Read existing `electron-store` JSON config from `~/Library/Application Support/OpenType/config.json`
- Convert to UserDefaults + Keychain format
- Offer one-time migration prompt on first launch

**Audio file migration:**
- Existing recorded audio files at `~/Library/Application Support/OpenType/recordings/` are **moved** to the new app's container (`~/Library/Application Support/com.opentype.macos/recordings/`)
- History store stores **relative paths** from the new container root
- After migration, original files in the old location are deleted
- Migration runs once on first launch; if already migrated, skip silently

## 14. Out of Scope (Phase 1)

The following features from the Electron version are **not** in scope for the initial native rewrite and may be added later:

- Native auto-updater for Windows (Electron cross-platform remnant)
- Python companion agent (`/agent` directory)
- Custom whisper.cpp binary bundling (using Apple Speech instead)
- Electron-specific IPC bridges and preload scripts

## 15. Project Structure in Xcode

```
OpenType.xcodeproj
├── Targets:
│   └── OpenType (macOS Application)
│       ├── Product: OpenType.app
│       ├── Deployment Target: macOS 13.0
│       ├── Swift Version: 5.9
│       ├── Code Signing: Developer ID
│       └── Sandbox: Disabled (requires system-wide accessibility)
│
└── Dependencies (Swift Package Manager):
    ├── SQLite.swift (latest stable)
    ├── Sparkle (latest stable)
    └── KeychainAccess (latest stable)
```

## 16. Build & Distribution

**Build:**
- Xcode build for macOS App Store (notarization required) or direct distribution
- Universal binary (arm64 + x64)
- Code signed with Developer ID

**Distribution:**
- Direct download from GitHub Releases
- Sparkle auto-update for direct distribution
- Homebrew Cask (optional future)
