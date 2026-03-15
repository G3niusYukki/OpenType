## ADDED Requirements

### Requirement: System health diagnostics
The system SHALL provide comprehensive diagnostics showing the health of all dependencies and permissions required for operation.

#### Scenario: View diagnostics page
- **WHEN** the user navigates to the Diagnostics page
- **THEN** the system SHALL display status for: microphone permission, accessibility permission, automation permission, ffmpeg availability, whisper.cpp availability, Whisper model availability, and active transcription provider

#### Scenario: All checks pass
- **WHEN** all diagnostics checks pass
- **THEN** the system SHALL display a "Ready to transcribe" indicator

#### Scenario: Permission denied
- **WHEN** a permission check fails
- **THEN** the system SHALL display the failure status with a "Fix" button that opens macOS System Settings

### Requirement: Permission status checking
The system SHALL check macOS permissions using AppleScript and system APIs.

#### Scenario: Check microphone permission
- **WHEN** the diagnostics system checks microphone permission
- **THEN** it SHALL return 'granted', 'denied', or 'unknown' based on system state

#### Scenario: Check accessibility permission
- **WHEN** the diagnostics system checks accessibility permission  
- **THEN** it SHALL query System Events via AppleScript and return the permission status

#### Scenario: Check automation permission
- **WHEN** the diagnostics system checks automation permission
- **THEN** it SHALL verify System Events can be scripted via AppleScript

### Requirement: Last failure tracking
The system SHALL track and display the most recent failure reason.

#### Scenario: Record failure
- **WHEN** an error occurs during recording or transcription
- **THEN** the system SHALL record the error message, timestamp, and context

#### Scenario: View last failure
- **WHEN** the user views the Diagnostics page
- **THEN** the system SHALL display the last failure with timestamp and recovery suggestion

### Requirement: Diagnostics refresh
The user SHALL be able to refresh diagnostics after fixing issues.

#### Scenario: Manual refresh
- **WHEN** the user clicks the "Refresh" button
- **THEN** the system SHALL re-run all diagnostics checks and update the display
