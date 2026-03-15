## ADDED Requirements

### Requirement: Secure API key storage
The system SHALL store provider API keys in macOS Keychain instead of plaintext electron-store.

#### Scenario: Store API key
- **WHEN** a provider API key is saved
- **THEN** the system SHALL store it in macOS Keychain using keytar
- **AND** only store metadata (enabled, model, baseUrl) in electron-store

#### Scenario: Retrieve API key
- **WHEN** a provider API key is needed for API calls
- **THEN** the system SHALL retrieve it from macOS Keychain
- **AND** return null if not found

#### Scenario: Delete API key
- **WHEN** a provider is disabled or removed
- **THEN** the system SHALL delete the API key from Keychain

### Requirement: Provider metadata separation
The system SHALL separate sensitive keys from non-sensitive metadata.

#### Scenario: Update provider config
- **WHEN** provider configuration is updated
- **THEN** metadata (enabled, model, baseUrl) SHALL be stored in electron-store
- **AND** apiKey SHALL be stored in Keychain
- **AND** hasKeyInKeychain flag SHALL be set in metadata
