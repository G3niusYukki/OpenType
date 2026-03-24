# OpenType

<p align="center">
  <strong>AI-Powered Voice-to-Text for macOS (Native)</strong><br>
  Type with your voice. Anywhere. Anytime.
</p>

<p align="center">
  <a href="https://github.com/G3niusYukki/OpenType/releases"><img src="https://img.shields.io/github/v/release/G3niusYukki/OpenType?include_prereleases&color=blue" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg" alt="Platform">
  <img src="https://img.shields.io/badge/Swift-5.9-orange.svg" alt="Swift">
  <img src="https://img.shields.io/badge/macOS-13%2B-blue.svg" alt="macOS 13+">
</p>

> **Note:** The native macOS rewrite (Swift + AppKit + SwiftUI) is the primary branch. The legacy Electron version is preserved in the `electron` branch for reference.

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#development">Development</a>
</p>

---

## Features

### Four Voice Input Modes

| Mode | Shortcut | Description |
|------|----------|-------------|
| **Basic Voice Input** | `⌘⇧D` | Hold to speak, release to send |
| **Hands-Free Mode** | `⌘⇧Space` | Toggle continuous recording |
| **Translate to English** | `⌘⇧T` | Speak in any language, get English output |
| **Edit Selected Text** | `⌘⇧E` | Select text, speak commands to edit |

### AI-Powered Processing

- **Filler Word Removal** — Automatically removes "um", "uh", "嗯", "啊"
- **Repetition Removal** — "你好你好" → "你好"
- **Self-Correction Detection** — Keeps only the final version when you correct yourself
- **AI Post-Processing** — Optional text polishing via OpenAI, Anthropic, DeepSeek, etc.

### Transcription Providers

- **Apple Speech** (on-device, offline) — No internet required
- **OpenAI Whisper** — Fast, accurate cloud transcription
- **Groq** — Ultra-fast Whisper inference

### AI Post-Processing Providers

- OpenAI GPT, Anthropic Claude, DeepSeek, Zhipu GLM, MiniMax, Moonshot, Groq

### Native macOS Integration

- **Menu Bar App** — No Dock icon, lives in the menu bar
- **Global Hotkeys** — Works from any application
- **Smart Text Insertion** — CGEvent paste with AppleScript fallback
- **Sparkle Auto-Update** — Automatic updates via GitHub Releases
- **System Diagnostics** — Permission status, audio device detection, network checks

### Privacy-First

- **BYOK** — Use your own API keys stored in macOS Keychain
- **On-Device Transcription** — Apple Speech works completely offline
- **No Data Collection** — Your voice never leaves your machine (with local mode)

---

## Installation

### Requirements

- **macOS 13.0+** (Ventura or later)
- **Xcode 15+** (for building from source)

### Download Binary

Download the latest release from [Releases](https://github.com/G3niusYukki/OpenType/releases):

```bash
curl -L -o OpenType.dmg https://github.com/G3niusYukki/OpenType/releases/latest/download/OpenType.dmg
open OpenType.dmg
```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/G3niusYukki/OpenType.git
cd OpenType

# Generate Xcode project
cd OpenType
xcodegen generate

# Open in Xcode
open OpenType.xcodeproj

# Or build from command line
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Release build
```

---

## Usage

### First Launch

OpenType runs as a menu bar app — look for the microphone icon in the menu bar.

1. **Grant Microphone Permission** when prompted
2. **Grant Speech Recognition Permission** when prompted
3. **Grant Accessibility Permission** (required for global hotkeys and text insertion) — open System Settings → Privacy & Security → Accessibility
4. Configure API keys in Settings if using cloud providers

### Voice Input

| Shortcut | Action |
|----------|--------|
| `⌘⇧D` | Hold to record, release to insert |
| `⌘⇧Space` | Toggle hands-free recording |
| `⌘⇧T` | Hold to translate to English |
| `⌘⇧E` | Edit selected text with voice |

### Settings

- **General** — Launch at login, hotkeys, notifications
- **Transcription** — Provider selection (Apple Speech / OpenAI Whisper / Groq), API keys
- **AI** — AI provider selection, API keys
- **Voice Modes** — Enable/disable each mode
- **Data** — Export/import history and dictionary, clear data

---

## Development

### Tech Stack

- **Swift 5.9+** — Language
- **AppKit + SwiftUI** — UI (hybrid approach)
- **Swift Package Manager** — Dependency management
- **XcodeGen** — Xcode project generation
- **SQLite.swift** — Structured data storage
- **Sparkle** — Auto-update framework
- **KeychainAccess** — Secure API key storage

### Architecture

```
OpenType/
├── Sources/
│   ├── App/               # main.swift, AppDelegate
│   ├── Services/          # Audio, Transcription, AI, Hotkey, TextInsertion, Diagnostics
│   ├── Providers/
│   │   ├── Transcription/ # AppleSpeech, OpenAI Whisper, Groq
│   │   └── AI/            # OpenAI, Anthropic, DeepSeek, etc.
│   ├── Models/            # VoiceMode, HistoryEntry, TranscriptionResult, etc.
│   ├── Data/              # SettingsStore (UserDefaults), HistoryStore (SQLite), KeychainManager
│   ├── Utilities/          # Constants, PermissionService
│   └── UI/
│       ├── StatusBar/     # NSStatusItem, icon states
│       ├── Popover/       # SwiftUI Popover
│       └── Windows/       # Settings, Main, Diagnostics windows
├── Resources/
│   ├── Info.plist
│   └── OpenType.entitlements
└── Package.swift           # SPM dependencies
```

### Setup

```bash
# Install XcodeGen
brew install xcodegen

# Generate Xcode project
cd OpenType
xcodegen generate

# Build
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build

# Or use SPM directly
swift build
```

### Modules

| Module | Description |
|--------|-------------|
| **App** | Executable entry point, AppDelegate |
| **Services** | AudioCapture, Transcription, AIProcessing, Hotkey, TextInsertion, Diagnostics, Migration |
| **Providers** | TranscriptionProvider, AIProvider implementations |
| **Models** | VoiceMode, HistoryEntry, TranscriptionResult, Profile, DictionaryEntry, etc. |
| **Data** | SettingsStore, HistoryStore, KeychainManager, ProfileStore |
| **Utilities** | Constants, PermissionService |
| **OpenTypeUI** | All SwiftUI views and NSWindowControllers |

### Migration from Electron

On first launch, OpenType automatically migrates settings from the legacy Electron version at `~/Library/Application Support/OpenType/`.

---

## Privacy & Security

- **API Keys** — Stored securely in macOS Keychain (never in UserDefaults or plaintext)
- **Voice Data** — Not stored after transcription; audio files are temporary
- **History** — Stored locally in `~/Library/Application Support/com.opentype.macos/`
- **No Telemetry** — No usage data sent to developers

---

## Troubleshooting

### "Accessibility Permission Required" alert

Go to **System Settings → Privacy & Security → Accessibility** and enable OpenType.

### "Microphone Permission Denied"

Go to **System Settings → Privacy & Security → Microphone** and enable OpenType.

### Hotkeys not working

1. Check Accessibility permission
2. Make sure no other app is using the same hotkey

### Text doesn't paste

1. Grant Accessibility permission
2. Text is always copied to clipboard as fallback — paste manually with `⌘V`

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and PR guidelines.

---

## License

[MIT License](LICENSE) © 2024 OpenType Contributors
