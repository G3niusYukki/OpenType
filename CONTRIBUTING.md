# Contributing to OpenType

Thank you for considering a contribution! This is the native macOS rewrite (Swift + AppKit + SwiftUI).

## How Can I Contribute?

### Reporting Bugs

1. Check existing issues
2. Collect: steps to reproduce, macOS version, error messages, logs
3. File at [GitHub Issues](https://github.com/G3niusYukki/OpenType/issues/new?template=bug_report.md)

### Suggesting Features

1. Check existing issues for similar suggestions
2. Explain the use case and your proposed solution
3. File at [GitHub Issues](https://github.com/G3niusYukki/OpenType/issues/new?template=feature_request.md)

### Pull Requests

1. Fork the repository and create your branch from `main`
2. Make your changes following the coding standards below
3. Ensure `swift build` passes
4. Submit a pull request with a clear description

---

## Development Setup

### Requirements

- **macOS 13.0+**
- **Xcode 15+** (or `swift build` from command line)
- **XcodeGen** (`brew install xcodegen`)

### Quick Start

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/OpenType.git
cd OpenType/OpenType

# Generate Xcode project
xcodegen generate

# Open in Xcode
open OpenType.xcodeproj

# Or build from command line
swift build
```

### Project Structure

```
OpenType/
├── Sources/
│   ├── App/               # main.swift (entry point), AppDelegate
│   ├── Services/          # AudioCaptureService, TranscriptionService, HotkeyService,
│   │                      # TextInsertionService, AIProcessingService, DiagnosticsService,
│   │                      # MigrationService
│   ├── Providers/
│   │   ├── Transcription/ # AppleSpeechProvider, OpenAIWhisperProvider,
│   │   │                  # GroqTranscriptionProvider
│   │   └── AI/           # OpenAIProvider, AnthropicProvider, DeepSeekProvider, etc.
│   ├── Models/           # VoiceMode, HistoryEntry, TranscriptionResult, Profile,
│   │                      # DictionaryEntry, DiagnosticResult, HotkeyConfig, etc.
│   ├── Data/             # SettingsStore (UserDefaults), HistoryStore (SQLite),
│   │                      # KeychainManager, ProfileStore
│   ├── Utilities/        # Constants, PermissionService, Extensions
│   └── UI/
│       ├── StatusBar/    # StatusBarController, StatusBarIcon
│       ├── Popover/      # PopoverView, PopoverViewModel
│       └── Windows/      # MainWindow, SettingsWindow, DiagnosticsWindow
├── Resources/
│   ├── Info.plist
│   ├── OpenType.entitlements
│   └── appcast.xml       # Sparkle update feed
└── Package.swift
```

### SPM Dependencies

| Package | Purpose |
|---------|---------|
| SQLite.swift | Structured data storage |
| Sparkle | Auto-update framework |
| KeychainAccess | Keychain API wrapper |

---

## Coding Standards

### Swift

- **Swift 5.9+**, strict concurrency where possible
- **Explicit `public`** for cross-module types
- **Swift actors** for thread-safe providers
- **`@MainActor`** for UI-bound services and view models
- **`@unchecked Sendable`** for safe singleton services

```swift
// Good — public cross-module types
public struct HistoryEntry: Identifiable, Codable {
    public let id: UUID
    public init(id: UUID = UUID()) { self.id = id }
}

// Good — actor for thread-safe provider
actor OpenAIWhisperProvider: TranscriptionProvider {
    public let name = "OpenAI Whisper"
    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult { ... }
}

// Good — @MainActor for UI services
@MainActor
class PopoverViewModel: ObservableObject {
    @Published var isRecording = false
}
```

### Module Architecture

| Rule | Reason |
|------|--------|
| Models → no dependencies | Foundation types used everywhere |
| Utilities → Models | Constants, helpers |
| Data → Models, Utilities | SettingsStore, HistoryStore |
| Providers → Models | TranscriptionProvider, AIProvider |
| Services → Models, Utilities, Data, Providers | Business logic |
| OpenTypeUI → Models, Utilities, Services, Data | All UI |

Circular dependencies are prevented by this hierarchy.

### Error Handling

```swift
// Good — specific error types
enum TranscriptionError: Error, LocalizedError {
    case speechPermissionDenied
    case recognitionFailed
    case providerUnavailable

    var errorDescription: String? {
        switch self {
        case .speechPermissionDenied: return "Speech recognition permission denied"
        case .recognitionFailed: return "Transcription failed"
        case .providerUnavailable: return "Transcription provider unavailable"
        }
    }
}
```

### View Models

- Use `@MainActor` for all view models
- Keep views thin — logic belongs in view models
- Use `@Published` for reactive state

### Testing

```bash
# Build and test
swift build
swift test
```

---

## Commit Messages

Use conventional commits:

```
feat(transcription): add Groq Whisper provider
fix(popover): prevent double-recording on rapid clicks
docs(readme): update installation instructions
refactor(services): use actor isolation for providers
```

---

## Release Process

1. Update version in relevant config
2. Tag: `git tag v0.x.x`
3. Push tag: `git push origin v0.x.x`
4. GitHub Actions builds and attaches to Release

---

## Questions?

- **Issues**: [GitHub Issues](https://github.com/G3niusYukki/OpenType/issues)
- **Discussions**: [GitHub Discussions](https://github.com/G3niusYukki/OpenType/discussions)

Thank you!
