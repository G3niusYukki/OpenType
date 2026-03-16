## Why

OpenType v0.1 established the core voice-to-text foundation, but Chinese users still face significant barriers: no dedicated Chinese ASR providers, limited punctuation handling for mixed Chinese/English content, and no way to manage or export their data. This change addresses these gaps to make OpenType a truly usable "daily driver" for Chinese users.

## What Changes

### Chinese ASR Provider Integration
- Integrate **Alibaba Cloud ASR** (阿里云语音识别) as the primary Chinese ASR provider
- Implement provider-specific authentication (AccessKey ID/Secret for Alibaba Cloud)
- Add connectivity testing and error handling for Chinese ASR APIs
- Implement fallback logic: if Chinese ASR fails, fall back to cloud providers (OpenAI/Groq)

### Enhanced Punctuation Handling
- Add intelligent punctuation restoration in AI post-processing pipeline
- Support per-language punctuation rules (Chinese full-width vs English half-width)
- Add user toggle for punctuation correction per language

### Data Export and Management
- Export transcription history to JSON/CSV
- Export custom dictionary to JSON
- Export app settings to JSON
- One-click cleanup: clear history, cache, and temporary audio files

### Improved Error Feedback
- Clear permission guidance for microphone, accessibility, and automation
- Provider-specific error messages with actionable fixes
- Visual indicators for provider status in settings

## Capabilities

### New Capabilities
- `aliyun-asr`: Alibaba Cloud ASR integration for Chinese speech recognition
- `chinese-punctuation`: Intelligent punctuation handling for Chinese/English mixed content
- `data-export`: Export history, dictionary, and settings
- `data-cleanup`: Clear local data and cache management
- `provider-fallback`: Fallback logic between transcription providers

### Modified Capabilities
- `provider-management`: Add provider-level configuration options and connectivity testing for transcription providers

## Impact

- **Core Transcription**: `src/main/transcription.ts` - add Alibaba Cloud ASR support
- **Provider Management**: `src/main/providers.ts` - extend provider configs for ASR-specific settings
- **AI Post-Processing**: `src/main/aiPostProcessor.ts` - add punctuation restoration
- **Settings UI**: `src/renderer/pages/SettingsPage.tsx` - add data export/cleanup UI
- **Store**: `src/main/store.ts` - add data export methods
- **Secure Storage**: `src/main/secure-storage.ts` - may need extension for provider-specific credentials
