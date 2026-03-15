## ADDED Requirements

### Requirement: Audio device enumeration
The system SHALL enumerate available audio input devices using ffmpeg.

#### Scenario: List audio devices
- **WHEN** the system requests audio device list
- **THEN** it SHALL execute `ffmpeg -f avfoundation -list_devices true -i ""` and parse the output
- **AND** return an array of devices with index and name

#### Scenario: No devices available
- **WHEN** no audio input devices are detected
- **THEN** the system SHALL return an empty array and log a warning

### Requirement: Device selection persistence
The system SHALL persist the user's selected audio device across restarts.

#### Scenario: Select device
- **WHEN** the user selects an audio device in Settings
- **THEN** the system SHALL store the device index and name in electron-store

#### Scenario: Load saved device
- **WHEN** the app starts
- **THEN** the system SHALL load the saved device preference from store

### Requirement: Device validation
The system SHALL validate the selected device before recording.

#### Scenario: Valid device selected
- **WHEN** recording starts with a valid selected device
- **THEN** the system SHALL use that device for ffmpeg input

#### Scenario: Selected device unavailable
- **WHEN** recording starts but the selected device is unavailable
- **THEN** the system SHALL log a warning
- **AND** fall back to the default device (:0)

### Requirement: Audio device UI
The user SHALL be able to select an audio device from Settings.

#### Scenario: Open device selector
- **WHEN** the user views Settings page
- **THEN** the system SHALL display a dropdown with available audio devices
- **AND** show the currently selected device

#### Scenario: Change device
- **WHEN** the user selects a different device from the dropdown
- **THEN** the system SHALL update the stored preference
- **AND** display a save confirmation

#### Scenario: Show current device
- **WHEN** the user views the device selector
- **THEN** the system SHALL display the currently active device name
- **AND** indicate if the default device is being used
