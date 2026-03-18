# Changelog

All notable changes to OpenType will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Auto-Update**: Automatically checks for updates from GitHub Releases on launch. Shows download progress and release notes, installs on restart.

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
