## 1. Alibaba Cloud ASR Integration

- [x] 1.1 Extend secure storage to support key-value credential pairs (AccessKey ID/Secret)
- [x] 1.2 Create Alibaba Cloud ASR provider implementation in `src/main/transcription.ts`
- [x] 1.3 Implement HMAC-SHA1 signature generation for Alibaba Cloud authentication
- [x] 1.4 Implement audio format conversion to PCM 16kHz for Alibaba Cloud API
- [x] 1.5 Add Alibaba Cloud ASR provider configuration to `src/main/providers.ts`
- [x] 1.6 Implement connectivity test for Alibaba Cloud using token endpoint
- [x] 1.7 Update `CloudProviderType` type to include 'aliyun-asr'
- [x] 1.8 Add error handling for Alibaba Cloud specific errors (quota, auth, rate limit)

## 2. Provider Management Enhancement

- [x] 2.1 Update `ProviderConfig` interface to support provider-specific options
- [x] 2.2 Implement provider-specific configuration UI rendering in SettingsPage
- [x] 2.3 Add provider status indicators (configured/health/last tested)
- [x] 2.4 Extend connection testing for all provider types with appropriate methods
- [ ] 2.5 Add detailed error messages with actionable guidance for each error type
- [ ] 2.6 Update provider health tracking with consecutive failure counting

## 3. Provider Fallback System

- [x] 3.1 Implement fallback chain logic in `TranscriptionService.transcribe()`
- [x] 3.2 Add fallback priority configuration to settings
- [x] 3.3 Implement fallback enable/disable toggle in UI
- [ ] 3.4 Add fallback indicator in transcription results
- [x] 3.5 Implement max fallback attempts limit (2 providers)
- [x] 3.6 Add comprehensive error reporting when all providers fail
- [ ] 3.7 Track and skip unhealthy providers in fallback chain

## 4. Chinese Punctuation Enhancement

- [x] 4.1 Add `restorePunctuation` option to `AiPostProcessingOptions` interface
- [x] 4.2 Add `punctuationLanguage` setting to store ('chinese', 'english', 'auto')
- [x] 4.3 Update AI post-processing prompt to include punctuation restoration
- [x] 4.4 Implement per-language punctuation rules in `aiPostProcessor.ts`
- [x] 4.5 Add punctuation settings UI to SettingsPage (toggle + language mode)
- [ ] 4.6 Ensure punctuation restoration preserves user-intentional formatting

## 5. Data Export Feature

- [x] 5.1 Implement `exportHistoryToJSON()` method in Store class
- [x] 5.2 Implement `exportHistoryToCSV()` method in Store class
- [x] 5.3 Implement `exportDictionaryToJSON()` method in Store class
- [x] 5.4 Implement `exportSettingsToJSON()` method (sanitized, no API keys)
- [x] 5.5 Add IPC handlers for export operations in main process
- [x] 5.6 Add export UI section to SettingsPage with format selection
- [x] 5.7 Implement file save dialog for choosing export location
- [x] 5.8 Add export functionality to preload/API bridge

## 6. Data Cleanup Feature

- [x] 6.1 Implement `getStorageStats()` method in Store class
- [x] 6.2 Implement `clearTemporaryFiles()` method with age filtering
- [x] 6.3 Implement `clearAllData()` method with settings reset
- [x] 6.4 Add confirmation dialogs for destructive operations
- [x] 6.5 Add Data Management section to SettingsPage
- [x] 6.6 Display storage usage statistics (history count, cache size, etc.)
- [x] 6.7 Add "Clear History", "Clear Cache", "Clear All Data" buttons with confirmations
- [x] 6.8 Ensure audio files are deleted when history is cleared

## 7. Error Feedback Improvement

- [ ] 7.1 Create error message mapping for provider-specific errors
- [ ] 7.2 Add permission guidance messages (microphone, accessibility, automation)
- [ ] 7.3 Implement error toast/notification system in renderer
- [ ] 7.4 Add error detail view with actionable fixes
- [ ] 7.5 Link to provider billing/console pages where applicable

## 8. Testing and Documentation

- [ ] 8.1 Test Alibaba Cloud ASR integration end-to-end
- [ ] 8.2 Test provider fallback scenarios
- [ ] 8.3 Test data export with various data sizes
- [ ] 8.4 Test data cleanup operations
- [x] 8.5 Update README with v0.2 features
- [x] 8.6 Update ROADMAP to mark v0.2 items as complete
