## ADDED Requirements

### Requirement: Clear transcription history
The system SHALL allow users to clear all transcription history with a confirmation dialog.

#### Scenario: Clear all history
- **GIVEN** user has transcription history
- **WHEN** user clicks "Clear History" and confirms the action
- **THEN** the system SHALL permanently delete all history entries
- **AND** delete associated audio files from storage
- **AND** display success message

#### Scenario: Cancel clear history
- **GIVEN** user clicked "Clear History"
- **WHEN** user cancels the confirmation dialog
- **THEN** the system SHALL NOT delete any data
- **AND** return to the settings page

### Requirement: Clear cache and temporary files
The system SHALL allow users to clear temporary audio files and cache.

#### Scenario: Clear temporary files
- **WHEN** user clicks "Clear Cache" and confirms
- **THEN** the system SHALL delete all temporary audio files older than 24 hours
- **AND** delete any failed transcription artifacts
- **AND** display amount of space freed

#### Scenario: Clear all local data
- **WHEN** user clicks "Clear All Data" and confirms
- **THEN** the system SHALL delete history, dictionary, and cache
- **AND** reset settings to defaults (except credentials)
- **AND** require explicit confirmation with typed confirmation text

### Requirement: Storage usage display
The system SHALL display current storage usage information.

#### Scenario: View storage usage
- **WHEN** user navigates to Settings → Data Management
- **THEN** the system SHALL display:
  - Total history entries count
  - Estimated storage used by audio files
  - Dictionary entry count
  - Cache size

### Requirement: Selective history deletion
The system SHALL support deleting individual history items (extends existing functionality).

#### Scenario: Delete single history item
- **GIVEN** user is viewing history
- **WHEN** user clicks delete on a specific item
- **THEN** the system SHALL delete that item and its audio file
- **AND** update the history list immediately
