# Changelog

All notable changes to OpenType will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-05-12

### Added

- **Style Profile System** — Learn your writing style from examples and apply it to AI output
  - StyleProfileService with prompt merging, token budget, and few-shot style examples
  - Save any dictation as a style example from the popover
  - Tone rules: global tone instructions (e.g., "be concise", "use active voice")
  - Tone presets: Formal, Casual, Professional, Friendly, Academic, Creative
  - Multiple named profiles with active profile switching
- **Per-App Tone Adaptation** — Different writing style per application
  - App-specific tone rules that override global rules
  - Auto-suggested app tones based on usage frequency
  - Style tab in Settings with app tone management
- **Language Auto-Detection** — Automatic language detection without manual locale selection
  - AppleSpeechAutoDetector: parallel multi-locale recognition with confidence scoring
  - Segment-level confidence averaging across SFSpeechRecognizer instances
  - Recent locales tracking (last 5 unique) for smarter locale selection
  - Groq model selection: whisper-large-v3 (multilingual) vs distil-whisper-large-v3-en (English)
  - VoiceModeConfig autoDetectLanguage toggle (default: enabled)
- **Enhanced Voice Editing** — 9 edit command types via voice
  - EditCommandDetector with keyword matching: rephrase, shorten, lengthen, change tone, translate, summarize, explain, fix grammar, custom
  - Read-only commands (summarize, explain, translate) insert text after selection instead of replacing
  - Locale-aware edit prompts (Chinese/English)
  - Style context integration for rephrase and change-tone commands
- **AI Provider Refactor** — Prompt parameter added to protocol
  - `process(prompt:text:apiKey:model:)` — system prompt + user text
  - `translate(prompt:text:from:to:apiKey:model:)` — translation with style context
  - Hardcoded prompts removed from all 7 providers
  - removeFillers() removed entirely

### Changed

- **StyleProfileService** — Singleton service for prompt construction
  - `buildSystemPrompt(appBundleID:)` returns system prompt only (clean system/user split)
  - `buildEditPrompt(selectedText:command:appBundleID:)` for edit mode
  - `buildTranslationPrompt(from:to:appBundleID:)` with optional app tone
- **PopoverViewModel** — Captures frontmost app bundle ID, routes edit commands through EditCommandDetector
- **TextInsertionService** — `insertTextAfterSelection()` for read-only edit commands
- **HistoryStore** — 4 new SQLite tables (style_profiles, style_examples, tone_rules, app_tone_rules) with ON DELETE CASCADE
- **HistoryStore** — ALTER TABLE migration for app_bundle_id column on history table
- **HistoryEntry** — appBundleID property tracked per entry
- **SettingsStore** — suggestedAppTones with 90-day pruning, recentLocales with UserDefaults persistence

### Fixed

- **Package.swift** — Utilities target now correctly depends on Models module
- **VoiceModeConfig** — Codable migration with decodeIfPresent for backward compatibility

## [0.5.0] - 2026-05-11

### Added

- **Alibaba Cloud ASR Provider** — New transcription provider with ACS3-HMAC-SHA256 signature v3
  - Support for AccessKey ID/Secret credential pairs
  - Full POP API integration for Chinese ASR
  - Multi-credential support in KeychainManager
- **6 New AI Providers** — Complete implementations for:
  - Groq (llama-3.3-70b-versatile)
  - Anthropic Claude (claude-3-sonnet)
  - DeepSeek (deepseek-chat)
  - Zhipu GLM (glm-4)
  - MiniMax (abab6.5s-chat)
  - Moonshot (moonshot-v1-8k)
- **AIProviderFactory** — Unified factory pattern for AI provider selection
- **Core Pipeline Routing** — All 4 voice modes now properly routed:
  - Basic: record → transcribe → dictionary → AI process → insert
  - Translate: record → transcribe → dictionary → AI translate → insert
  - Edit Selected: get selected text → record → transcribe → AI edit → replace selection
  - Hands-Free: toggle start/stop with proper state management
- **Dictionary Service** — Real-time word replacement from user dictionary
  - Longest-match-first replacement to prevent partial matches
  - Case-insensitive and width-insensitive matching
- **Profile Service** — Profile activation now updates transcription/AI provider settings
- **Error Banner UI** — Toast-style error display with retry option
- **Notification Service** — Transcription completion notifications via UserNotifications
- **Launch at Login** — SMAppService integration for auto-launch
- **Streaming Transcription** — New `transcribeStreaming()` protocol method with `AsyncThrowingStream`
  - AppleSpeechProvider supports real-time partial results
- **About Page** — App version, build info, links in Settings
- **Sparkle Update Feed** — SUFeedURL configured for auto-updates

### Fixed

- **Audio Level Detection** — Replaced fake `Float.random()` with real RMS audio metering
  - Calculates dB levels from actual audio buffers
  - Smooth level transitions for better UX
- **AIProcessingService** — Removed hardcoded OpenAIProvider
  - Now uses AIProviderFactory with user-selected provider
- **HistoryStore** — Replaced `fatalError` with proper error throwing
- **LSUIElement** — Fixed to `true` for true menu bar app behavior (no Dock icon)
- **Hotkey Hot-Reload** — Changing hotkeys in Settings now takes effect immediately without restart
- **Hands-Free Toggle** — StatusBarController now handles hands-free hotkey for toggle behavior
- **Voice Mode Filtering** — Disabled voice modes are hidden from the popover and their hotkeys are not registered
- **Audio Playback** — Replaced unreliable timer-based stop with `AVAudioPlayerDelegate`
- **App Termination** — Proper cleanup on exit: stop recording, clean temp files, unregister hotkeys
- **Alibaba Cloud ASR** — Signature upgraded to ACS3-HMAC-SHA256 v3 with proper timestamp and x-acs-* headers
- **Temp File Cleanup** — Automatic cleanup of old recording files, keeping recent 20
- **OpenAIProvider** — Updated default model from deprecated gpt-3.5-turbo to gpt-4o-mini

### Changed

- **Project Cleanup** — Moved Electron legacy code to `deprecated/` directory
- **CI/CD** — Updated GitHub Actions for Swift project
- **Tests** — Added 17 unit tests covering models, settings, dictionary, and voice mode configs

## [0.4.0] - 2026-03-24

### Added

- **Native macOS Rewrite** — Complete rewrite from Electron to native Swift + AppKit + SwiftUI
  - Menu bar app (LSUIElement) with SwiftUI Popover
  - 4 voice input modes: Basic, Hands-Free, Translate, Edit Selected
  - Multi-provider transcription: Apple Speech (on-device), OpenAI Whisper, Groq
  - Multi-provider AI post-processing: OpenAI GPT, Anthropic Claude, DeepSeek, Zhipu GLM, MiniMax, Moonshot, Groq
  - CGEventTap global hotkeys (⌘⇧D/Space/T/E)
  - Text insertion via CGEvent paste + AppleScript fallback + clipboard
  - Sparkle auto-update with GitHub Releases feed
  - SQLite.swift history + dictionary storage
  - KeychainAccess for secure API key storage
  - System diagnostics panel
  - Electron config migration on first launch

### Architecture

- Swift Package Manager modules: App, Services, Providers, Models, Data, Utilities, OpenTypeUI
- XcodeGen for Xcode project generation
- macOS 13.0+ deployment target

## [0.3.5] - 2026-03-23

### Added

- **Design System**: Complete UI redesign with glass morphism (frosted glass) visual style, CSS Modules architecture, and comprehensive design tokens (`tokens.css`)
- **UI Components**: New shared component library — Button, Card, Modal, Badge, Toggle, StatusRow, ConfirmDialog, Tooltip, Input, Select
- **HomePage**: New split-panel layout (40% record control / 60% results), audio waveform animation, recording timer, provider dropdown (Auto/Local/Cloud), transcription history tab
- **SettingsPage**: Refactored into 5-tab navigation — General, Transcription, AI, Voice Modes, Data
- **OnboardingWizard**: New 4-step first-run wizard — Microphone permission, Accessibility permission, Provider selection, Ready screen
- **HistoryPage**: Added audio playback with native audio controls
- **ProfilesPage**: Modal-based profile editing instead of inline form

### Fixed

- **HomePage**: Fixed `handleImport` misnamed as export function → renamed to `handleExport`; fixed hardcoded hotkey in empty state; fixed provider constants recreating on every render
- **UpdateModal**: "Later" button now correctly dismisses the update instead of re-checking
- **DictionaryPage**: Fixed misnamed `handleImport` function that performed export logic
- **Global CSS**: Added missing `animate-spin` keyframe (previously caused silent failures in SystemStatusPanel)

### Changed

- **MainLayout**: Refactored from inline styles to CSS Module; added icon + tooltip navigation
- **Test suite**: Updated all tests for redesigned UI, added CSS module type declarations (`vite-env.d.ts`)

## [0.3.4] - 2026-03-19

### Fixed

- **Auto-Update**: Fixed "Download & Install" not responding when running directly from DMG (read-only volume). Now detects read-only app path and shows a helpful error message directing users to install to /Applications first.

## [0.3.3] - 2026-03-19

### Added

- **Auto-Update**: Automatically checks for updates from GitHub Releases on launch. Shows download progress and release notes, installs on restart.

## [0.3.2] - 2026-03-19

### Added

- **Dynamic Tray Menu**: Right-click tray icon now shows live status (provider, language, model, recording indicator). Menu rebuilds fresh on each right-click.

## [0.3.1] - 2026-03-19

## [0.3.0] - 2026-03-18

### Added

- **Voice Command Recognition**: In Edit mode, voice commands are now parsed by prefix:
  - `翻译成英文` / `translate to English` → translate selected text to English
  - `翻译成中文` / `translate to Chinese` → translate selected text to Chinese
  - `翻译成日文` / `translate to Japanese` → translate selected text to Japanese
  - `翻译成韩文` / `translate to Korean` → translate selected text to Korean
  - `新行` / `new line` → insert a newline after selected text
  - `删除最后一句` / `delete last sentence` → remove the last sentence
  - `撤销` / `undo` → undo (logged, not yet implemented)
  - `加标题` / `add heading` → format selected text with a heading
  - `总结` / `summarize` → summarize selected text
  - `改正式` / `make formal` → make tone more formal
  - `改口语` / `make casual` → make tone more casual
  - No prefix → insert transcribed text as content after selected text

- **Extended Multilingual Translation**: Translation mode now supports configurable language pairs: CN↔EN, CN↔JP, CN↔KR, EN↔JP, EN↔KR. Selected via dropdown in Settings under Voice Input Modes.

- **Enhanced Dictionary**:
  - Dictionary entries now support categories: General, Technical, Names, Custom
  - Category filter tabs and color-coded chips in the UI
  - Batch import from JSON or CSV files
  - Export dictionary to JSON or CSV
  - Search/filter entries

- **Model Management UI**: New "Local Models" section in Settings shows all downloaded whisper.cpp models with file size and a delete button.

### Changed

- Translation mode now uses configurable language pairs instead of hardcoded CN→EN

## [0.1.1] - 2024-03-14

### Fixed
- Fixed keyboard shortcuts not responding by refactoring to singleton uIOhook manager
- Added tray icon state indicator (changes icon when recording)
- Fixed multiple simultaneous hold-to-speak shortcuts (basic, translate, edit modes)
- Added accessibility permission check on macOS startup

### Added
- Visual feedback for recording state in tray icon
- Better error handling for keyboard shortcut registration failures

## [0.1.0] - 2024-03-14

### Added
- Four voice input modes with toggle switches:
  - Basic Voice Input (hold-to-speak)
  - Hands-Free Mode (toggle recording)
  - Translate to English (CN→EN)
  - Edit Selected Text (AI-powered editing)
- Individual hotkeys for each voice input mode
- Chinese ASR provider configurations (阿里云, 腾讯云, 百度, 科大讯飞) - API integration pending
- Better microphone permission error handling
- Voice Input Modes section in Settings

### Changed
- Separated transcription providers from post-processing providers in Settings UI
- Improved provider configuration organization
- Enhanced error messages for permission issues

## [0.1.0] - 2024-03-14

### Added
- Initial release of OpenType
- **Core Features:**
  - One-click dictation with global hotkey
  - Menu bar tray integration
  - Smart text insertion via AppleScript
  - Transcription history management
  - Custom dictionary for word replacements
  
- **Transcription Providers:**
  - Local transcription with whisper.cpp
  - OpenAI Whisper API
  - Groq Whisper API
  
- **AI Post-Processing:**
  - Filler word removal ("um", "uh", "嗯", "啊")
  - Repetition removal
  - Self-correction detection
  - Support for multiple AI providers:
    - OpenAI (GPT models)
    - Anthropic (Claude)
    - Groq
    - DeepSeek
    - 智谱 GLM
    - MiniMax
    - Moonshot (Kimi)

- **Multi-language Support:**
  - English (en)
  - Chinese (zh)
  - Japanese (ja)
  - Korean (ko)

- **System Integration:**
  - Global hotkey (`Cmd+Shift+D` default)
  - Native macOS text insertion
  - Accessibility permission handling
  - Microphone permission handling

### Technical
- Electron 36+ with React 19
- TypeScript 5.8+ strict mode
- Vite for fast builds
- ffmpeg for audio capture (AVFoundation)
- electron-store for persistence

---

## Versioning Guidelines

- **MAJOR** version (X.0.0): Incompatible API changes
- **MINOR** version (0.X.0): New functionality, backwards compatible
- **PATCH** version (0.0.X): Bug fixes, backwards compatible

## Categories

- `Added` - New features
- `Changed` - Changes to existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security-related changes
