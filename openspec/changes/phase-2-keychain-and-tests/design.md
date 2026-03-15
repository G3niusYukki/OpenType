## Context

OpenType currently stores sensitive API keys in plaintext in electron-store. This is a security vulnerability as the data is stored in JSON format in the user's application support directory. The app also lacks comprehensive tests for the complex fallback logic that occurs when transcription providers fail or dependencies are missing.

### Current State

**API Key Storage:**
- Stored in `electron-store` under `providers[].apiKey`
- Plaintext JSON file at `~/Library/Application Support/OpenType/opentype-config.json`
- No encryption or protection

**Test Coverage:**
- Basic unit tests for store, transcription, providers
- No tests for provider fallback chains
- No tests for missing dependency paths
- No integration tests

### Security Requirements

- Store API keys in macOS Keychain using keytar
- Keep provider metadata (enabled, model, baseUrl) in electron-store
- Migrate existing keys on first launch
- Verify keys after migration before deleting plaintext

### Testing Requirements

- Test provider fallback: whisper.cpp → OpenAI → Groq
- Test all providers failing
- Test missing ffmpeg, whisper.cpp, model
- Test configuration validation
- Test text insertion methods

## Goals / Non-Goals

**Goals:**
1. Secure API key storage in macOS Keychain
2. Automatic migration from plaintext to secure storage
3. Comprehensive test coverage for critical paths
4. Maintain backward compatibility during migration

**Non-Goals:**
1. Cross-platform secure storage (Windows/Linux) - macOS only for now
2. Encrypting non-secret data (history, settings)
3. Real-time key rotation
4. Cloud key management

## Decisions

### Decision 1: Use keytar over electron-safe-storage
**Rationale:** keytar provides named keychain entries (service/account) which is cleaner than electron-safe-storage's encrypted blobs that need separate storage.

**Alternative:** electron-safe-storage - rejected because it requires storing encrypted data separately.

### Decision 2: Store keys by provider ID
**Format:** Service: `com.opentype.desktop.api-keys`, Account: `{providerId}`

**Rationale:** Simple lookup by provider ID. Easy to manage and delete.

### Decision 3: Migration on app startup
**Flow:**
1. Check for `apiKey` in provider configs
2. If found, migrate to Keychain
3. Verify read-back from Keychain
4. Remove plaintext `apiKey` from config
5. Add `hasKeyInKeychain: true` flag

**Rationale:** One-time migration is simpler than lazy migration. Ensures all keys are secured.

### Decision 4: Keep metadata in electron-store
**Stored:** enabled, model, baseUrl, hasKeyInKeychain
**Moved to Keychain:** apiKey

**Rationale:** Metadata is not sensitive and is frequently read. Keys are only read when making API calls.

### Decision 5: Test organization by concern
**Structure:**
- Unit tests: Individual modules
- Integration tests: Cross-module interactions
- Mock external dependencies (Keychain, API calls)

**Rationale:** Clear separation makes tests easier to maintain and understand.

## Risks / Trade-offs

**[Risk] keytar is archived/unmaintained**
→ Mitigation: It's stable and widely used. Can migrate to alternative if needed.

**[Risk] Migration failure could lock users out**
→ Mitigation: Verify key read-back before deleting plaintext. Rollback on failure.

**[Risk] Tests may be brittle with Electron APIs**
→ Mitigation: Comprehensive mocking layer. Don't test Electron itself.

**[Trade-off] Additional dependency (keytar)**
→ Decision: Worth it for proper security. Native module but well-supported.

**[Trade-off] Slightly slower key retrieval (Keychain vs memory)**
→ Decision: Negligible impact. Keys cached in ProviderManager after first read.

## Migration Plan

1. **Startup Check:** Look for `apiKey` in provider configs
2. **Migration:** For each provider with `apiKey`:
   - Store in Keychain
   - Verify read-back
   - Remove from config
   - Set `hasKeyInKeychain: true`
3. **Validation:** Ensure all keys accessible
4. **Rollback:** If any migration fails, keep plaintext and log error

## Open Questions

1. Should we provide a "Re-migrate" option in settings if migration fails?
2. How should we handle migration errors - silent log or user notification?
3. Should we add a "Security" section in Settings showing keychain status?
