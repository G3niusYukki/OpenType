## Context

OpenType currently supports:
- Local transcription via whisper.cpp
- Cloud transcription via OpenAI and Groq Whisper APIs
- AI post-processing via multiple LLM providers

However, Chinese users face several pain points:
1. **No dedicated Chinese ASR**: whisper.cpp works but isn't optimized for Chinese; OpenAI/Groq are foreign services with latency/cost issues for Chinese users
2. **Punctuation issues**: Chinese text often lacks proper punctuation or mixes full-width/half-width characters incorrectly
3. **Data management**: Users cannot export their transcription history or dictionary; no way to bulk clean old data
4. **Provider reliability**: No fallback mechanism when a provider fails; poor error messages

## Goals / Non-Goals

**Goals:**
- Integrate Alibaba Cloud ASR as a first-class transcription provider optimized for Chinese
- Implement provider fallback chain: Alibaba Cloud → OpenAI/Groq → Local whisper.cpp
- Add intelligent punctuation restoration in post-processing pipeline
- Enable data export (history, dictionary, settings) to JSON/CSV
- Add one-click data cleanup functionality
- Improve error feedback with actionable guidance

**Non-Goals:**
- Real-time streaming transcription (v0.4)
- Additional Chinese ASR providers beyond Alibaba Cloud (v0.3+)
- Automatic language detection (v0.3+)
- Cloud sync or backup (v0.5+)

## Decisions

### 1. Alibaba Cloud ASR as Primary Chinese Provider
**Rationale**: Alibaba Cloud ASR has excellent Chinese support, competitive pricing, and a well-documented REST API. It's the most mature option among Chinese providers.

**Implementation approach**:
- Use Alibaba Cloud NLS (Natural Language Service) REST API
- Requires AccessKey ID + AccessKey Secret (different from simple API keys)
- Audio format: PCM/WAV, 16kHz, 16-bit, mono
- Authentication: HMAC-SHA1 signature-based

**Alternatives considered**:
- Tencent Cloud ASR: Good but more complex authentication
- Baidu ASR: Lower accuracy in our testing
- iFlytek: Excellent but requires WebSocket for real-time (out of scope)

### 2. Separate Credentials Storage for Chinese ASR
**Rationale**: Alibaba Cloud uses AccessKey ID/Secret pair rather than a single API key. This requires different UI and storage handling.

**Implementation approach**:
- Extend secure storage to support key-value pairs per provider
- Store `accessKeyId` and `accessKeySecret` separately for Alibaba Cloud
- UI shows two input fields for Alibaba Cloud provider

### 3. Post-Processing Pipeline for Punctuation
**Rationale**: Rather than modifying each ASR provider's output separately, centralize punctuation handling in the AI post-processing stage where we already have text enhancement logic.

**Implementation approach**:
- Add `restorePunctuation` option to `AiPostProcessingOptions`
- Add `punctuationLanguage` setting ('chinese', 'english', 'auto')
- Use LLM prompt engineering to restore/fix punctuation
- For Chinese: ensure full-width punctuation (，。！？）
- For English: ensure half-width punctuation (, . ! ?)

### 4. Data Export Format
**Rationale**: JSON is most flexible for structured data; CSV is user-friendly for history viewing in Excel.

**Implementation approach**:
- History: export as JSON (full metadata) and CSV (text/timestamp only)
- Dictionary: export as JSON
- Settings: export as JSON (sanitized, no API keys)

### 5. Provider Fallback Chain
**Rationale**: Users want reliable transcription; if their preferred provider fails, automatic fallback prevents disruption.

**Implementation approach**:
- Priority order: User-configured provider → Other enabled cloud providers → Local whisper.cpp
- Each provider gets max 2 retry attempts
- If all fail, return error with details of each failure
- User can disable fallback in settings if they want strict provider selection

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Alibaba Cloud API changes | Abstract provider implementation; monitor API documentation |
| HMAC signature complexity | Use well-tested crypto library; thorough unit tests |
| Punctuation prompts increase token cost | Make optional; cache common patterns |
| Export files may contain sensitive data | Warn user before export; exclude API keys by default |
| Fallback loops | Implement attempt tracking; max 1 fallback per request |

## Migration Plan

1. **Phase 1**: Add Alibaba Cloud provider support (no UI changes yet)
2. **Phase 2**: Update Settings UI for provider configuration
3. **Phase 3**: Add punctuation restoration to post-processing
4. **Phase 4**: Add data export/cleanup features
5. **Phase 5**: Update documentation and release notes

**Rollback**: Disable Alibaba Cloud provider in settings; previous providers remain functional.

## Open Questions

1. Should we implement a minimal Alibaba Cloud test that doesn't consume quota?
2. What's the maximum audio file size for Alibaba Cloud ASR?
3. Should punctuation restoration be a separate pre-processing step before LLM enhancement?
