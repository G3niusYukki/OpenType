# Changelog

All notable changes to OpenType will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
