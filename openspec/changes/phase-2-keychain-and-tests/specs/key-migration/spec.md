## ADDED Requirements

### Requirement: Automatic key migration
The system SHALL automatically migrate existing plaintext API keys to secure storage on app startup.

#### Scenario: Migration on startup
- **WHEN** the app starts
- **AND** plaintext API keys exist in electron-store
- **THEN** the system SHALL migrate each key to Keychain
- **AND** verify read-back from Keychain
- **AND** remove plaintext keys after successful migration
- **AND** set hasKeyInKeychain flag

#### Scenario: Partial migration failure
- **WHEN** migration of a specific key fails
- **THEN** the system SHALL keep the plaintext key
- **AND** log the error
- **AND** continue with other keys

#### Scenario: Migration already complete
- **WHEN** the app starts
- **AND** no plaintext keys exist
- **THEN** the system SHALL skip migration
