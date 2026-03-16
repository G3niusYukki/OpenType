## ADDED Requirements

### Requirement: Automatic provider fallback
The system SHALL automatically fall back to alternative transcription providers when the primary provider fails.

#### Scenario: Primary provider failure triggers fallback
- **GIVEN** Alibaba Cloud ASR is configured as primary provider
- **AND** OpenAI is configured as fallback provider
- **WHEN** Alibaba Cloud ASR returns an error
- **THEN** the system SHALL automatically retry with OpenAI
- **AND** record the fallback event in logs

#### Scenario: Successful fallback
- **GIVEN** primary provider failed
- **WHEN** fallback provider succeeds
- **THEN** the system SHALL return the transcription result
- **AND** indicate in the result that fallback was used
- **AND** display a subtle indicator to the user

#### Scenario: All providers fail
- **GIVEN** all configured providers have been attempted
- **WHEN** all providers return errors
- **THEN** the system SHALL return a comprehensive error message
- **AND** list which providers were tried and their error types

### Requirement: Fallback configuration
The system SHALL allow users to configure fallback behavior.

#### Scenario: Enable/disable fallback
- **WHEN** user toggles "Enable Fallback" in settings
- **THEN** the system SHALL enable or disable automatic fallback
- **AND** when disabled, only use the explicitly selected provider

#### Scenario: Configure fallback priority
- **GIVEN** multiple providers are enabled
- **WHEN** user configures fallback priority order
- **THEN** the system SHALL use that order for fallback attempts

### Requirement: Fallback with different provider types
The system SHALL support fallback between different provider types (cloud and local).

#### Scenario: Cloud to local fallback
- **GIVEN** cloud provider fails due to network error
- **AND** local whisper.cpp is available
- **WHEN** fallback is triggered
- **THEN** the system SHALL attempt local transcription
- **AND** inform user that local transcription is being used

#### Scenario: Local to cloud fallback
- **GIVEN** local whisper.cpp fails (e.g., model not found)
- **AND** cloud provider is configured
- **WHEN** fallback is triggered
- **THEN** the system SHALL attempt cloud transcription
- **AND** inform user about the fallback

### Requirement: Fallback limits
The system SHALL limit fallback attempts to prevent infinite loops.

#### Scenario: Maximum fallback attempts reached
- **GIVEN** fallback has been attempted for 2 providers already
- **WHEN** the third provider also fails
- **THEN** the system SHALL stop attempting fallbacks
- **AND** return the final error to the user

### Requirement: Provider health tracking
The system SHALL track provider health to optimize fallback decisions.

#### Scenario: Mark unhealthy provider
- **GIVEN** a provider has failed multiple consecutive times
- **THEN** the system SHALL temporarily mark it as unhealthy
- **AND** skip it in fallback chain for a cooldown period
