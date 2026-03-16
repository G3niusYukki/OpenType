## ADDED Requirements

### Requirement: Alibaba Cloud ASR provider configuration
The system SHALL support configuring Alibaba Cloud ASR as a transcription provider with AccessKey ID and AccessKey Secret credentials.

#### Scenario: Provider configuration saved
- **WHEN** user enters AccessKey ID and AccessKey Secret for Alibaba Cloud ASR
- **THEN** the system SHALL store credentials securely in macOS Keychain
- **AND** the provider SHALL be available for selection in transcription settings

#### Scenario: Invalid credentials rejected
- **WHEN** user enters empty or malformed AccessKey credentials
- **THEN** the system SHALL display an error message
- **AND** the configuration SHALL NOT be saved

### Requirement: Alibaba Cloud ASR transcription
The system SHALL transcribe audio files using Alibaba Cloud NLS REST API when the provider is enabled and selected.

#### Scenario: Successful transcription
- **GIVEN** Alibaba Cloud ASR is the active provider
- **AND** valid credentials are configured
- **WHEN** an audio file is submitted for transcription
- **THEN** the system SHALL send the audio to Alibaba Cloud NLS API
- **AND** return the transcribed text

#### Scenario: Authentication failure
- **GIVEN** Alibaba Cloud ASR is the active provider
- **AND** credentials are invalid or expired
- **WHEN** an audio file is submitted for transcription
- **THEN** the system SHALL return an error indicating authentication failure
- **AND** trigger fallback to next available provider if fallback is enabled

#### Scenario: API quota exceeded
- **GIVEN** Alibaba Cloud ASR is the active provider
- **WHEN** the API returns quota exceeded error
- **THEN** the system SHALL display a user-friendly error message
- **AND** suggest checking Alibaba Cloud console for quota limits

### Requirement: Audio format conversion
The system SHALL convert audio to the format required by Alibaba Cloud ASR (PCM, 16kHz, 16-bit, mono).

#### Scenario: Audio conversion on transcription
- **WHEN** audio transcription is requested with Alibaba Cloud ASR
- **THEN** the system SHALL convert the audio to 16kHz PCM format using ffmpeg
- **AND** clean up temporary files after transcription completes

### Requirement: Provider connectivity testing
The system SHALL support testing Alibaba Cloud ASR connectivity without consuming transcription quota.

#### Scenario: Connectivity test success
- **GIVEN** valid Alibaba Cloud credentials are configured
- **WHEN** user clicks "Test Connection" button
- **THEN** the system SHALL verify credential validity via token endpoint
- **AND** display success message

#### Scenario: Connectivity test failure
- **GIVEN** invalid or missing Alibaba Cloud credentials
- **WHEN** user clicks "Test Connection" button
- **THEN** the system SHALL display specific error message
- **AND** suggest corrective action
