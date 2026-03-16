## ADDED Requirements

### Requirement: Export transcription history
The system SHALL allow users to export their transcription history in JSON and CSV formats.

#### Scenario: Export history as JSON
- **WHEN** user clicks "Export History" and selects JSON format
- **THEN** the system SHALL generate a JSON file containing all history items
- **AND** include fields: id, timestamp, text, rawText, processedText, provider, status
- **AND** prompt user to choose save location

#### Scenario: Export history as CSV
- **WHEN** user clicks "Export History" and selects CSV format
- **THEN** the system SHALL generate a CSV file with columns: timestamp, text, provider
- **AND** format timestamps in human-readable format
- **AND** handle text containing commas and quotes correctly

#### Scenario: Export filtered history
- **GIVEN** user has filtered history by date range or search term
- **WHEN** user clicks "Export History"
- **THEN** the system SHALL export only the filtered results
- **AND** indicate in the filename that export is filtered

### Requirement: Export custom dictionary
The system SHALL allow users to export their custom dictionary.

#### Scenario: Export dictionary as JSON
- **WHEN** user clicks "Export Dictionary"
- **THEN** the system SHALL generate a JSON file containing all dictionary entries
- **AND** include fields: word, replacement
- **AND** preserve entry order

### Requirement: Export settings
The system SHALL allow users to export their app settings (excluding sensitive data).

#### Scenario: Export settings as JSON
- **WHEN** user clicks "Export Settings"
- **THEN** the system SHALL generate a JSON file with all user settings
- **AND** exclude API keys and credentials
- **AND** include a warning that provider credentials must be re-configured

### Requirement: Export UI
The system SHALL provide a clear UI for data export in the Settings page.

#### Scenario: Access export functionality
- **WHEN** user navigates to Settings → Data Management
- **THEN** the system SHALL display export options for History, Dictionary, and Settings
- **AND** show file format options where applicable

#### Scenario: Empty data export attempt
- **GIVEN** no data exists for the selected export type
- **WHEN** user attempts to export
- **THEN** the system SHALL display a message indicating no data to export
- **AND** disable the export button or show it as disabled
