## Why

OpenType currently stores API keys in plaintext using electron-store, which poses a security risk. Users with access to the app's data directory can read these keys. Additionally, the test coverage is insufficient for the complex fallback logic and edge cases in provider management, dependency handling, and text insertion.

## What Changes

### Issue #1 - Keychain Storage for API Keys
- **New**: SecureStorage module using keytar for macOS Keychain
- **New**: Migration system to move existing plaintext keys to Keychain
- **Modified**: Provider configuration to separate metadata from secrets
- **Modified**: Settings UI to show secure storage indicators
- **Removed**: Plaintext API key storage (after migration)

### Issue #3 - Strengthen Test Coverage
- **New**: Comprehensive tests for provider fallback chains
- **New**: Tests for missing dependency handling
- **New**: Provider configuration edge case tests
- **New**: Text insertion fallback flow tests
- **New**: Main process integration tests
- **New**: Secure storage unit tests

## Capabilities

### New Capabilities
- `secure-api-key-storage`: Store and retrieve API keys from macOS Keychain
- `key-migration`: Migrate existing plaintext keys to secure storage

### Modified Capabilities
- `provider-configuration`: Store metadata separately from secrets

## Impact

**Security Improvements:**
- API keys encrypted in macOS Keychain
- Metadata (enabled, model) remains in electron-store
- Automatic migration on first launch
- Backward compatible (reads old format, writes new format)

**Test Coverage:**
- Provider fallback chain: whisper.cpp → OpenAI → Groq
- Missing dependency paths: ffmpeg, whisper, model
- Configuration edge cases: invalid API keys, malformed URLs
- Text insertion fallbacks: paste → clipboard → type → failed
- Integration tests for full recording flow

**Files Modified:**
- `src/main/store.ts` - Migration logic
- `src/main/providers.ts` - Use secure storage
- `src/main/transcription.ts` - Use secure storage
- `src/main/aiPostProcessor.ts` - Use secure storage
- `src/renderer/pages/SettingsPage.tsx` - Show security indicators

**Files Created:**
- `src/main/secure-storage.ts`
- `tests/unit/secure-storage.test.ts`
- `tests/unit/provider-fallback.test.ts`
- `tests/unit/dependency-paths.test.ts`
- `tests/unit/provider-config-edge-cases.test.ts`
- `tests/unit/text-insertion-fallback.test.ts`
- `tests/integration/main-process.test.ts`
