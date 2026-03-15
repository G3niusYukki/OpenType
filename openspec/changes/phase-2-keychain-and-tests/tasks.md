## 1. Secure Storage Module

- [ ] 1.1 Install keytar dependency
- [ ] 1.2 Create `src/main/secure-storage.ts` with SecureStorage class
- [ ] 1.3 Implement setProviderApiKey(providerId, apiKey) method
- [ ] 1.4 Implement getProviderApiKey(providerId) method
- [ ] 1.5 Implement deleteProviderApiKey(providerId) method
- [ ] 1.6 Add SERVICE constant for keychain service name
- [ ] 1.7 Add error handling for keychain operations
- [ ] 1.8 Export SecureStorage interface and singleton

## 2. Migration System

- [ ] 2.1 Add checkForPlaintextKeys() method to Store class
- [ ] 2.2 Add migrateKeysToKeychain() method with verification
- [ ] 2.3 Call migration on app startup in main.ts
- [ ] 2.4 Add migration status logging
- [ ] 2.5 Handle partial migration failures gracefully
- [ ] 2.6 Add hasKeyInKeychain flag to ProviderConfig

## 3. Provider Configuration Refactor

- [ ] 3.1 Update ProviderConfig interface (remove apiKey, add hasKeyInKeychain)
- [ ] 3.2 Modify providers.ts to use secure storage for API keys
- [ ] 3.3 Update transcription.ts to retrieve keys from secure storage
- [ ] 3.4 Update aiPostProcessor.ts to retrieve keys from secure storage
- [ ] 3.5 Add getApiKey(providerId) helper in providers.ts
- [ ] 3.6 Update test connection logic to use secure storage

## 4. Settings UI Updates

- [ ] 4.1 Add Lock icon to Settings page imports
- [ ] 4.2 Show lock icon next to providers with keys in Keychain
- [ ] 4.3 Add "Stored securely in Keychain" tooltip
- [ ] 4.4 Update save logic to use secure storage
- [ ] 4.5 Add visual indicator for secure storage status

## 5. Secure Storage Tests

- [ ] 5.1 Create `tests/unit/secure-storage.test.ts`
- [ ] 5.2 Mock keytar module
- [ ] 5.3 Test setProviderApiKey success and failure
- [ ] 5.4 Test getProviderApiKey success and failure
- [ ] 5.5 Test deleteProviderApiKey
- [ ] 5.6 Test error handling

## 6. Provider Fallback Tests

- [ ] 6.1 Create `tests/unit/provider-fallback.test.ts`
- [ ] 6.2 Mock TranscriptionService with multiple providers
- [ ] 6.3 Test chain: whisper.cpp → OpenAI → Groq
- [ ] 6.4 Test all providers failing
- [ ] 6.5 Test provider timeout handling
- [ ] 6.6 Test temporary failure recovery

## 7. Dependency Path Tests

- [ ] 7.1 Create `tests/unit/dependency-paths.test.ts`
- [ ] 7.2 Test missing ffmpeg → placeholder mode
- [ ] 7.3 Test missing whisper.cpp → skip local
- [ ] 7.4 Test missing model → show download prompt
- [ ] 7.5 Test missing API key → skip cloud provider

## 8. Configuration Edge Case Tests

- [ ] 8.1 Create `tests/unit/provider-config-edge-cases.test.ts`
- [ ] 8.2 Test invalid API key format
- [ ] 8.3 Test malformed base URL
- [ ] 8.4 Test empty model selection
- [ ] 8.5 Test duplicate provider IDs
- [ ] 8.6 Test provider ID with special characters

## 9. Text Insertion Fallback Tests

- [ ] 9.1 Create `tests/unit/text-insertion-fallback.test.ts`
- [ ] 9.2 Test accessibility permission denied → clipboard fallback
- [ ] 9.3 Test AppleScript failure → clipboard fallback
- [ ] 9.4 Test very long text insertion
- [ ] 9.5 Test special character handling

## 10. Integration Tests

- [ ] 10.1 Create `tests/integration/main-process.test.ts`
- [ ] 10.2 Mock audio input for determinism
- [ ] 10.3 Test full flow: recording → transcription → insertion
- [ ] 10.4 Test provider auto-switching
- [ ] 10.5 Test error recovery

## 11. Test Infrastructure

- [ ] 11.1 Update `tests/unit/mocks/electronAPI.ts` with secure storage mocks
- [ ] 11.2 Add keytar mock factory
- [ ] 11.3 Update Store mock with migration methods
- [ ] 11.4 Add ProviderManager mock with secure storage

## 12. Build and Verification

- [ ] 12.1 Run `npm install` to add keytar
- [ ] 12.2 Run `npm run build` to compile TypeScript
- [ ] 12.3 Run `npm test` and verify all tests pass
- [ ] 12.4 Run `npm run typecheck` and verify no type errors
- [ ] 12.5 Test migration with existing config
- [ ] 12.6 Test key storage and retrieval

## 13. Documentation

- [ ] 13.1 Update README.md with security improvements
- [ ] 13.2 Add troubleshooting for keychain issues
- [ ] 13.3 Document test coverage improvements
