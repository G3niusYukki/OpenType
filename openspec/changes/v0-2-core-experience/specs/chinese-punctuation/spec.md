## ADDED Requirements

### Requirement: Intelligent punctuation restoration
The system SHALL support automatic punctuation restoration and correction during AI post-processing.

#### Scenario: Chinese punctuation restoration enabled
- **GIVEN** AI post-processing is enabled
- **AND** punctuation restoration is enabled for Chinese
- **WHEN** transcription text contains Chinese content with missing or incorrect punctuation
- **THEN** the AI SHALL restore appropriate Chinese full-width punctuation marks（，。！？；：""''）

#### Scenario: English punctuation correction enabled
- **GIVEN** AI post-processing is enabled
- **AND** punctuation restoration is enabled for English
- **WHEN** transcription text contains English content with missing or incorrect punctuation
- **THEN** the AI SHALL correct English half-width punctuation marks (, . ! ? ; : "")

#### Scenario: Mixed language punctuation
- **GIVEN** AI post-processing is enabled
- **AND** punctuation restoration is set to "auto" detect language
- **WHEN** transcription contains mixed Chinese and English content
- **THEN** the AI SHALL apply appropriate punctuation style for each language segment

### Requirement: Punctuation settings UI
The system SHALL provide user-configurable settings for punctuation handling.

#### Scenario: User enables punctuation restoration
- **WHEN** user enables "Restore punctuation" in AI post-processing settings
- **THEN** the system SHALL apply punctuation correction to future transcriptions
- **AND** the setting SHALL persist across app restarts

#### Scenario: User selects punctuation language mode
- **WHEN** user selects punctuation language mode (Chinese/English/Auto)
- **THEN** the system SHALL apply the selected mode to punctuation restoration
- **AND** display a brief explanation of each mode

### Requirement: Punctuation preservation
The system SHALL preserve user-intentional punctuation choices when appropriate.

#### Scenario: User uses specific formatting
- **GIVEN** user intentionally uses unconventional punctuation (e.g., artistic formatting)
- **WHEN** AI post-processing with punctuation restoration runs
- **THEN** the system SHALL preserve the user's intentional formatting
- **AND** only fix obvious missing or incorrect punctuation
