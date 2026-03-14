# Security Policy

## Supported Versions

This project is in early development. Please use the latest commit on `main` unless a tagged release says otherwise.

## Reporting a Vulnerability

Please do not open public issues for security-sensitive reports.

Instead, contact the maintainer privately first and include:
- affected version / commit
- reproduction steps
- impact assessment
- suggested mitigation, if known

Until a dedicated security inbox is added, use GitHub private reporting if available for the repository.

## Data Handling Notes

OpenType is designed around a BYOK (Bring Your Own Key) model.

- Audio may stay local when local transcription is used.
- If you configure a cloud provider, audio/text may be sent to that provider according to your configuration.
- API keys should be stored locally on your machine and never committed to the repository.

## Hardening Expectations

Before public binary releases:
- enable dependency alerts / updates
- verify no secrets are present in source or CI logs
- sign and notarize macOS builds
- document microphone and accessibility permission requirements clearly
