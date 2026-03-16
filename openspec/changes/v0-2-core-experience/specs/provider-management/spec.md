## MODIFIED Requirements

### Requirement: Provider configuration with transcription-specific settings
The system SHALL support provider-level configuration including transcription-specific options.

#### Scenario: Configure transcription provider
- **WHEN** user configures a transcription provider (OpenAI, Groq, Alibaba Cloud)
- **THEN** the system SHALL allow setting:
  - API credentials (key or AccessKey ID/Secret)
  - Base URL (for custom endpoints)
  - Default model selection
  - Provider-specific options
- **AND** validate the configuration before saving

#### Scenario: Configure post-processing provider
- **WHEN** user configures a post-processing provider
- **THEN** the system SHALL allow setting API credentials
- **AND** select supported models
- **AND** test connection to verify credentials

### Requirement: Provider connection testing
The system SHALL support testing connectivity for all providers with appropriate test methods.

#### Scenario: Test cloud transcription provider
- **GIVEN** OpenAI or Groq provider is configured
- **WHEN** user clicks "Test Connection"
- **THEN** the system SHALL make a lightweight API call to list models
- **AND** report success or failure with specific error details

#### Scenario: Test Alibaba Cloud provider
- **GIVEN** Alibaba Cloud ASR is configured
- **WHEN** user clicks "Test Connection"
- **THEN** the system SHALL verify AccessKey credentials via token endpoint
- **AND** report success or failure with Alibaba Cloud-specific error details

#### Scenario: Test local whisper.cpp
- **GIVEN** local transcription is selected
- **WHEN** system checks status
- **THEN** the system SHALL verify whisper.cpp binary exists
- **AND** verify model file is available
- **AND** display path information

#### Scenario: Test post-processing provider
- **GIVEN** an AI provider (Anthropic, DeepSeek, etc.) is configured
- **WHEN** user clicks "Test Connection"
- **THEN** the system SHALL make a lightweight API call
- **AND** verify the API key is valid

### Requirement: Provider error handling and feedback
The system SHALL provide clear error messages with actionable guidance when provider configuration fails.

#### Scenario: Invalid API key error
- **GIVEN** user entered invalid API key
- **WHEN** connection test runs
- **THEN** the system SHALL display "Invalid API key"
- **AND** suggest checking the key in provider dashboard

#### Scenario: Network connectivity error
- **GIVEN** network is unavailable
- **WHEN** connection test runs
- **THEN** the system SHALL display "Network error"
- **AND** suggest checking internet connection

#### Scenario: Rate limit error
- **GIVEN** provider API rate limit is exceeded
- **WHEN** transcription is attempted
- **THEN** the system SHALL display rate limit message
- **AND** suggest waiting before retrying

#### Scenario: Quota exceeded error
- **GIVEN** provider account has no remaining quota
- **WHEN** transcription is attempted
- **THEN** the system SHALL display quota exceeded message
- **AND** link to provider billing page if available

### Requirement: Provider status indicators
The system SHALL display visual status indicators for each provider in the settings UI.

#### Scenario: Show provider status
- **GIVEN** user is viewing provider settings
- **THEN** the system SHALL display for each provider:
  - Configuration status (configured / not configured)
  - Last tested timestamp
  - Connection health indicator (green/yellow/red)

## ADDED Requirements

### Requirement: Provider-specific configuration UI
The system SHALL render appropriate configuration UI based on provider type.

#### Scenario: Alibaba Cloud configuration UI
- **WHEN** configuring Alibaba Cloud ASR
- **THEN** the system SHALL show:
  - AccessKey ID input field
  - AccessKey Secret input field (password type)
  - Link to Alibaba Cloud console
  - Region selection dropdown

#### Scenario: Standard API key configuration UI
- **WHEN** configuring standard providers (OpenAI, Groq, etc.)
- **THEN** the system SHALL show:
  - API key input field (password type)
  - Optional base URL field
  - Model selection dropdown
