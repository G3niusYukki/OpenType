# OpenType Native macOS Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite OpenType from Electron to native macOS app using Swift + AppKit + SwiftUI hybrid.

**Architecture:** Menu bar app (LSUIElement), SwiftUI Popover for quick actions, NSWindow + SwiftUI for complex views, AppKit for system integration.

**Tech Stack:** Swift 5.9+, Swift Package Manager, SQLite.swift, Sparkle, KeychainAccess, AVFoundation, Speech, CoreGraphics, Security.

---

## Phase 1: Project Setup

### Task 1: Create Xcode Project Structure

**Files:**
- Create: `OpenType/Package.swift`
- Create: `OpenType/project.yml` (XcodeGen)
- Create: `OpenType/.gitignore`
- Test: `xcodebuild -scheme OpenType -resolvePackageDependencies`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p OpenType/Sources/{App,UI/{StatusBar,Popover,Windows},Services,Providers/{Transcription,AI},Models,Data,Utilities}
mkdir -p OpenType/Resources
mkdir -p OpenType/Tests
```

- [ ] **Step 2: Create Package.swift with SPM dependencies**

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenType",
    platforms: [.macOS(.v13)],
    products: [
        .executable(
            name: "OpenType",
            targets: ["App"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/stephencelis/SQLite.swift", from: "0.15.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.0"),
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.2.0"),
    ],
    targets: [
        .executableTarget(
            name: "App",
            dependencies: [
                "Services",
                "Providers",
                "Models",
                "Data",
                .product(name: "SQLite", package: "SQLite.swift"),
                .product(name: "KeychainAccess", package: "KeychainAccess"),
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            path: "Sources/App"
        ),
        .target(name: "Services", path: "Sources/Services"),
        .target(name: "Providers", dependencies: ["Models"], path: "Sources/Providers"),
        .target(name: "Models", path: "Sources/Models"),
        .target(name: "Data", dependencies: ["Models", .product(name: "SQLite", package: "SQLite.swift"), .product(name: "KeychainAccess", package: "KeychainAccess")], path: "Sources/Data"),
        .target(name: "Utilities", path: "Sources/Utilities"),
        .testTarget(name: "AppTests", dependencies: ["App", "Services", "Data"], path: "Tests"),
    ]
)
```

- [ ] **Step 3: Create project.yml for XcodeGen**

```yaml
name: OpenType
options:
  bundleIdPrefix: com.opentype
  deploymentTarget:
    macOS: "13.0"
  xcodeVersion: "15.0"
  generateEmptyDirectories: true

packages:
  SQLite:
    url: https://github.com/stephencelis/SQLite.swift
    from: 0.15.0
  Sparkle:
    url: https://github.com/sparkle-project/Sparkle
    from: 2.6.0
  KeychainAccess:
    url: https://github.com/kishikawakatsumi/KeychainAccess
    from: 4.2.0

targets:
  OpenType:
    type: application
    platform: macOS
    deploymentTarget: 13.0
    sources:
      - path: Sources/App
      - path: Sources/UI
      - path: Sources/Services
      - path: Sources/Providers
      - path: Sources/Models
      - path: Sources/Data
      - path: Sources/Utilities
    resources:
      - path: Resources
    dependencies:
      - package: SQLite
      - package: Sparkle
      - package: KeychainAccess
    info:
      path: Resources/Info.plist
      properties:
        CFBundleName: OpenType
        CFBundleDisplayName: OpenType
        CFBundleIdentifier: com.opentype.macos
        CFBundleVersion: "1"
        CFBundleShortVersionString: "0.1.0"
        CFBundlePackageType: APPL
        CFBundleExecutable: OpenType
        LSMinimumSystemVersion: "13.0"
        LSUIElement: true
        NSPrincipalClass: NSApplication
        NSMicrophoneUsageDescription: "OpenType needs microphone access to record your voice for transcription."
        NSSpeechRecognitionUsageDescription: "OpenType uses speech recognition to transcribe your voice."
    entitlements:
      path: Resources/OpenType.entitlements
      properties:
        com.apple.security.device.microphone: true
        com.apple.security.device.audio-input: true
    settings:
      base:
        SWIFT_VERSION: "5.9"
        MACOSX_DEPLOYMENT_TARGET: "13.0"
        CODE_SIGN_IDENTITY: "-"
        CODE_SIGN_STYLE: Manual
        PRODUCT_BUNDLE_IDENTIFIER: com.opentype.macos
        INFOPLIST_FILE: Resources/Info.plist
        CODE_SIGN_ENTITLEMENTS: Resources/OpenType.entitlements
        ENABLE_HARDENED_RUNTIME: YES

schemes:
  OpenType:
    build:
      targets:
        OpenType: all
    run:
      config: Debug
```

- [ ] **Step 4: Create Info.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>OpenType</string>
    <key>CFBundleDisplayName</key><string>OpenType</string>
    <key>CFBundleIdentifier</key><string>com.opentype.macos</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>CFBundleShortVersionString</key><string>0.1.0</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleExecutable</key><string>OpenType</string>
    <key>LSMinimumSystemVersion</key><string>13.0</string>
    <key>LSUIElement</key><true/>
    <key>NSPrincipalClass</key><string>NSApplication</string>
    <key>NSMicrophoneUsageDescription</key><string>OpenType needs microphone access to record your voice for transcription.</string>
    <key>NSSpeechRecognitionUsageDescription</key><string>OpenType uses speech recognition to transcribe your voice.</string>
</dict>
</plist>
```

- [ ] **Step 5: Create OpenType.entitlements**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.device.microphone</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
```

- [ ] **Step 6: Generate Xcode project**

```bash
cd .worktrees/native-rewrite
which xcodegen || brew install xcodegen
xcodegen generate
```

- [ ] **Step 7: Verify project resolves packages**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -resolvePackageDependencies 2>&1 | tail -5
```

Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "phase1: create Xcode project structure with SPM dependencies"
```

---

### Task 2: Create App Entry Point

**Files:**
- Create: `Sources/App/main.swift`
- Create: `Sources/App/AppDelegate.swift`
- Create: `Sources/Utilities/Constants.swift`
- Test: `xcodebuild -scheme OpenType -destination 'platform=macOS' build 2>&1 | grep -E "(error|warning:.*App|Build succeeded)"`
- Reference: `docs/superpowers/specs/2026-03-24-opentype-native-rewrite-design.md` (Section 4)

- [ ] **Step 1: Create main.swift (no @main attribute)**

```swift
import AppKit

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
```

- [ ] **Step 2: Create Constants.swift**

```swift
import Foundation

enum Constants {
    static let appBundleIdentifier = "com.opentype.macos"
    static let appName = "OpenType"
    static let appVersion = "0.1.0"

    enum Keychain {
        static let service = "com.opentype.macos"
    }

    enum UserDefaults {
        static let suiteName = "com.opentype.macos"
        static let selectedTranscriptionProvider = "selectedTranscriptionProvider"
        static let selectedAIProvider = "selectedAIProvider"
        static let launchAtLogin = "launchAtLogin"
        static let notificationsEnabled = "notificationsEnabled"
        static let lastProfileID = "lastProfileID"
    }

    enum SQLite {
        static let databaseName = "opentype.sqlite3"
    }

    enum Hotkeys {
        static let defaultBasic = (keyCode: 2, modifiers: CGEventFlags.maskCommand.union(.maskShift)) // D
        static let defaultHandsFree = (keyCode: 49, modifiers: CGEventFlags.maskCommand.union(.maskShift)) // Space
        static let defaultTranslate = (keyCode: 17, modifiers: CGEventFlags.maskCommand.union(.maskShift)) // T
        static let defaultEditSelected = (keyCode: 14, modifiers: CGEventFlags.maskCommand.union(.maskShift)) // E
    }

    enum UI {
        static let popoverWidth: CGFloat = 320
        static let popoverHeight: CGFloat = 400
        static let mainWindowWidth: CGFloat = 600
        static let mainWindowHeight: CGFloat = 500
        static let settingsWindowWidth: CGFloat = 650
        static let settingsWindowHeight: CGFloat = 550
        static let diagnosticsWindowWidth: CGFloat = 500
        static let diagnosticsWindowHeight: CGFloat = 400
    }
}
```

- [ ] **Step 3: Create AppDelegate.swift (stub - full implementation in Phase 2)**

```swift
import AppKit
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusBarController: StatusBarController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Phase 2: Full implementation with permissions and services
        statusBarController = StatusBarController()
        print("OpenType launched (stub)")
    }

    func applicationWillTerminate(_ notification: Notification) {
        print("OpenType terminating")
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false // Menu bar app - no windows required
    }
}
```

- [ ] **Step 4: Create placeholder StatusBarController**

```swift
import AppKit

class StatusBarController {
    private var statusItem: NSStatusItem

    init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "mic.fill", accessibilityDescription: "OpenType")
        }
    }
}
```

- [ ] **Step 5: Build to verify**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
```

Expected: BUILD SUCCEEDED

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "phase1: add app entry point (main.swift, AppDelegate stub)"
```

---

## Phase 2: Status Bar & Menu Bar App

### Task 3: StatusBarController with Icon States

**Files:**
- Modify: `Sources/App/AppDelegate.swift`
- Create: `Sources/UI/StatusBar/StatusBarController.swift`
- Create: `Sources/UI/StatusBar/StatusBarIcon.swift`
- Test: Visual verification (run app, check menu bar icon)
- Reference: `docs/superpowers/specs/...md` Section 5.1

- [ ] **Step 1: Create StatusBarIcon enum for icon states**

```swift
import AppKit

enum StatusBarIcon {
    case idle
    case recording
    case processing
    case error

    var symbolName: String {
        switch self {
        case .idle: return "mic.fill"
        case .recording: return "mic.fill"
        case .processing: return "arrow.triangle.2.circlepath"
        case .error: return "exclamationmark.mic.fill"
        }
    }

    var tintColor: NSColor {
        switch self {
        case .idle: return .secondaryLabelColor
        case .recording: return .systemRed
        case .processing: return .systemBlue
        case .error: return .systemOrange
        }
    }
}
```

- [ ] **Step 2: Create full StatusBarController**

```swift
import AppKit
import SwiftUI

class StatusBarController: ObservableObject {
    private var statusItem: NSStatusItem
    private var popover: NSPopover
    @Published var currentIcon: StatusBarIcon = .idle

    init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        popover = NSPopover()

        setupStatusItem()
        setupPopover()
    }

    private func setupStatusItem() {
        guard let button = statusItem.button else { return }
        button.image = NSImage(systemSymbolName: StatusBarIcon.idle.symbolName, accessibilityDescription: "OpenType")
        button.action = #selector(togglePopover)
        button.target = self
    }

    private func setupPopover() {
        popover.contentSize = NSSize(width: Constants.UI.popoverWidth, height: Constants.UI.popoverHeight)
        popover.behavior = .transient
        popover.animates = true
    }

    @objc private func togglePopover() {
        if popover.isShown {
            closePopover()
        } else {
            showPopover()
        }
    }

    func showPopover() {
        guard let button = statusItem.button else { return }
        popover.contentViewController = NSHostingController(rootView: PopoverView())
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
    }

    func closePopover() {
        popover.performClose(nil)
    }

    func updateIcon(_ icon: StatusBarIcon) {
        DispatchQueue.main.async { [weak self] in
            self?.currentIcon = icon
            self?.statusItem.button?.image = NSImage(
                systemSymbolName: icon.symbolName,
                accessibilityDescription: "OpenType"
            )
            if let button = self?.statusItem.button {
                button.contentTintColor = icon.tintColor
            }
        }
    }
}
```

- [ ] **Step 3: Create placeholder PopoverView (full implementation in Task 5)**

```swift
import SwiftUI

struct PopoverView: View {
    var body: some View {
        VStack {
            Text("OpenType Popover")
                .padding()
            Text("Recording UI coming soon")
                .foregroundColor(.secondary)
        }
        .frame(width: Constants.UI.popoverWidth, height: Constants.UI.popoverHeight)
    }
}
```

- [ ] **Step 4: Update AppDelegate to inject StatusBarController**

```swift
class AppDelegate: NSObject, NSApplicationDelegate {
    let statusBarController = StatusBarController()

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Permission checks will be added in Phase 3
        print("OpenType launched")
    }
}
```

- [ ] **Step 5: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase2: StatusBarController with icon states and PopoverView stub"
```

---

### Task 4: Popover Recording UI

**Files:**
- Create: `Sources/UI/Popover/PopoverView.swift`
- Create: `Sources/UI/Popover/RecordingControlsView.swift`
- Create: `Sources/UI/Popover/TranscriptionResultView.swift`
- Modify: `Sources/UI/Popover/PopoverView.swift` (placeholder → full)
- Test: Build + visual test
- Reference: `docs/superpowers/specs/...md` Section 5.2

- [ ] **Step 1: Create RecordingControlsView**

```swift
import SwiftUI

struct RecordingControlsView: View {
    @Binding var isRecording: Bool
    @Binding var currentMode: VoiceMode
    let onStartRecording: () -> Void
    let onStopRecording: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text(currentMode.displayName)
                .font(.headline)
                .foregroundColor(.primary)

            Button(action: {
                if isRecording {
                    onStopRecording()
                } else {
                    onStartRecording()
                }
            }) {
                ZStack {
                    Circle()
                        .fill(isRecording ? Color.red : Color.accentColor)
                        .frame(width: 64, height: 64)

                    if isRecording {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.white)
                            .frame(width: 20, height: 20)
                    } else {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 24, height: 24)
                    }
                }
            }
            .buttonStyle(.plain)

            Text(isRecording ? "Tap to stop" : "Tap to start")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
```

- [ ] **Step 2: Create TranscriptionResultView**

```swift
import SwiftUI

struct TranscriptionResultView: View {
    let text: String
    let isProcessing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Result")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                if isProcessing {
                    ProgressView()
                        .scaleEffect(0.5)
                        .frame(width: 16, height: 16)
                }
            }

            if text.isEmpty && !isProcessing {
                Text("Your transcription will appear here...")
                    .foregroundColor(.secondary)
                    .italic()
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text(text)
                    .font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}
```

- [ ] **Step 3: Create full PopoverView with mode selector and history**

```swift
import SwiftUI

struct PopoverView: View {
    @StateObject private var viewModel = PopoverViewModel()
    @State private var selectedMode: VoiceMode = .basic

    var body: some View {
        VStack(spacing: 0) {
            // Mode selector
            Picker("Mode", selection: $selectedMode) {
                ForEach(VoiceMode.allCases, id: \.self) { mode in
                    Text(mode.displayName).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.top, 12)

            // Recording controls
            RecordingControlsView(
                isRecording: $viewModel.isRecording,
                currentMode: $selectedMode,
                onStartRecording: { viewModel.startRecording(mode: selectedMode) },
                onStopRecording: { viewModel.stopRecording() }
            )

            Divider()
                .padding(.vertical, 8)

            // Result
            TranscriptionResultView(
                text: viewModel.transcribedText,
                isProcessing: viewModel.isProcessing
            )

            Divider()
                .padding(.vertical, 8)

            // Quick history
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Recent")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Button("History") {
                        viewModel.openHistory()
                    }
                    .buttonStyle(.plain)
                    .font(.caption)
                }

                if viewModel.recentHistory.isEmpty {
                    Text("No recent transcriptions")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    ForEach(viewModel.recentHistory.prefix(3), id: \.id) { entry in
                        Button(action: { viewModel.copyToClipboard(entry.processedText) }) {
                            HStack {
                                Text(entry.processedText)
                                    .lineLimit(1)
                                    .font(.caption)
                                    .foregroundColor(.primary)
                                Spacer()
                                Text(entry.createdAt, style: .relative)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal)

            // Bottom bar
            HStack {
                Spacer()
                Button(action: { viewModel.openSettings() }) {
                    Image(systemName: "gear")
                }
                .buttonStyle(.plain)
            }
            .padding(8)
        }
        .frame(width: Constants.UI.popoverWidth, height: Constants.UI.popoverHeight)
    }
}
```

- [ ] **Step 4: Create PopoverViewModel stub with placeholder services**

```swift
import SwiftUI
import Combine

@MainActor
class PopoverViewModel: ObservableObject {
    @Published var isRecording = false
    @Published var isProcessing = false
    @Published var transcribedText = ""
    @Published var recentHistory: [HistoryEntry] = []

    func startRecording(mode: VoiceMode) {
        isRecording = true
        transcribedText = ""
        print("Started recording in \(mode.displayName) mode")
    }

    func stopRecording() {
        isRecording = false
        isProcessing = true
        print("Stopped recording, processing...")
        // Will be connected to services in Phase 4
        Task {
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            transcribedText = "Sample transcription result"
            isProcessing = false
        }
    }

    func openHistory() {
        NotificationCenter.default.post(name: .openHistoryWindow, object: nil)
    }

    func openSettings() {
        NotificationCenter.default.post(name: .openSettingsWindow, object: nil)
    }

    func copyToClipboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
}

extension Notification.Name {
    static let openHistoryWindow = Notification.Name("openHistoryWindow")
    static let openSettingsWindow = Notification.Name("openSettingsWindow")
}
```

- [ ] **Step 5: Add VoiceMode model stub**

```swift
import Foundation

enum VoiceMode: String, CaseIterable, Identifiable {
    case basic
    case handsFree
    case translate
    case editSelected

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .basic: return "Basic"
        case .handsFree: return "Hands-Free"
        case .translate: return "Translate"
        case .editSelected: return "Edit"
        }
    }

    var hotkeyDescription: String {
        switch self {
        case .basic: return "⌘⇧D"
        case .handsFree: return "⌘⇧Space"
        case .translate: return "⌘⇧T"
        case .editSelected: return "⌘⇧E"
        }
    }
}
```

- [ ] **Step 6: Add HistoryEntry model stub**

```swift
import Foundation

struct HistoryEntry: Identifiable {
    let id: UUID
    let audioPath: String
    let originalText: String
    let processedText: String
    let mode: VoiceMode
    let provider: String
    let createdAt: Date
    let duration: TimeInterval
    let language: String
}
```

- [ ] **Step 7: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase2: Popover recording UI with mode selector and history"
```

---

## Phase 3: Services Core

### Task 5: AudioCaptureService

**Files:**
- Create: `Sources/Services/AudioCaptureService.swift`
- Create: `Sources/Services/PermissionService.swift`
- Test: Unit test for recording flow
- Reference: `docs/superpowers/specs/...md` Section 6.1

- [ ] **Step 1: Create PermissionService**

```swift
import AVFoundation
import Speech
import AppKit

enum PermissionStatus {
    case granted
    case denied
    case notDetermined
}

class PermissionService {
    static let shared = PermissionService()

    private init() {}

    func requestMicrophonePermission() async -> PermissionStatus {
        await withCheckedContinuation { continuation in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                continuation.resume(returning: granted ? .granted : .denied)
            }
        }
    }

    func requestSpeechPermission() async -> PermissionStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                switch status {
                case .authorized: continuation.resume(returning: .granted)
                case .denied, .restricted: continuation.resume(returning: .denied)
                case .notDetermined: continuation.resume(returning: .notDetermined)
                @unknown default: continuation.resume(returning: .notDetermined)
                }
            }
        }
    }

    func checkAccessibilityPermission() -> Bool {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: false] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    func requestAccessibilityPermission() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
    }

    func checkMicrophonePermission() -> PermissionStatus {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return .granted
        case .denied, .restricted: return .denied
        case .notDetermined: return .notDetermined
        @unknown default: return .notDetermined
        }
    }

    func checkSpeechPermission() -> PermissionStatus {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return .granted
        case .denied, .restricted: return .denied
        case .notDetermined: return .notDetermined
        @unknown default: return .notDetermined
        }
    }
}
```

- [ ] **Step 2: Create AudioCaptureService**

```swift
import AVFoundation
import Foundation

enum AudioCaptureError: Error {
    case notPermitted
    case engineStartFailed
    case noInputDevice
    case recordingInProgress
    case notRecording
    case fileWriteFailed
}

@MainActor
class AudioCaptureService: ObservableObject {
    static let shared = AudioCaptureService()

    @Published private(set) var isRecording = false
    @Published private(set) var audioLevel: Float = 0.0

    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    private var audioFile: AVAudioFile?
    private var levelTimer: Timer?
    private var recordingStartTime: Date?
    private var tempRecordingURL: URL {
        let tempDir = FileManager.default.temporaryDirectory
        return tempDir.appendingPathComponent("opentype_recording_\(UUID().uuidString).wav")
    }

    private init() {}

    func startRecording() async throws {
        guard PermissionService.shared.checkMicrophonePermission() == .granted else {
            let status = await PermissionService.shared.requestMicrophonePermission()
            if status != .granted {
                throw AudioCaptureError.notPermitted
            }
        }

        guard !isRecording else { throw AudioCaptureError.recordingInProgress }

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: [])
        try audioSession.setActive(true)

        audioEngine = AVAudioEngine()
        guard let engine = audioEngine else { throw AudioCaptureError.engineStartFailed }

        inputNode = engine.inputNode
        guard let inputNode = inputNode else { throw AudioCaptureError.noInputDevice }

        let format = inputNode.outputFormat(forBus: 0)
        let recordingFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 16000,
            channels: 1,
            interleaved: false
        )!

        guard let converter = AVAudioConverter(from: format, to: recordingFormat) else {
            throw AudioCaptureError.engineStartFailed
        }

        audioFile = try AVAudioFile(
            forWriting: tempRecordingURL,
            settings: recordingFormat.settings,
            commonFormat: .pcmFormatFloat32,
            interleaved: false
        )

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            Task { @MainActor in
                self?.processAudioBuffer(buffer, converter: converter)
            }
        }

        try engine.start()
        isRecording = true
        recordingStartTime = Date()
        startLevelMeter()
    }

    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, converter: AVAudioConverter) {
        guard let audioFile = audioFile else { return }

        let frameCapacity = AVAudioFrameCount(
            Double(buffer.frameLength) * 16000.0 / buffer.format.sampleRate
        )
        guard let convertedBuffer = AVAudioPCMBuffer(
            pcmFormat: converter.outputFormat,
            frameCapacity: frameCapacity
        ) else { return }

        var error: NSError?
        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
            outStatus.pointee = .haveData
            return buffer
        }

        converter.convert(to: convertedBuffer, error: &error, withInputFrom: inputBlock)

        if error == nil {
            try? audioFile.write(from: convertedBuffer)
        }
    }

    private func startLevelMeter() {
        levelTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateAudioLevel()
            }
        }
    }

    private func updateAudioLevel() {
        guard isRecording else { return }
        // Simplified: use a random value for now, will be improved
        audioLevel = Float.random(in: 0.1...0.8)
    }

    func stopRecording() async throws -> (url: URL, duration: TimeInterval) {
        guard isRecording else { throw AudioCaptureError.notRecording }

        levelTimer?.invalidate()
        levelTimer = nil

        inputNode?.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        inputNode = nil

        let duration = recordingStartTime.map { Date().timeIntervalSince($0) } ?? 0
        let url = tempRecordingURL

        audioFile = nil
        isRecording = false
        audioLevel = 0

        try AVAudioSession.sharedInstance().setActive(false)

        return (url, duration)
    }

    func getRecordingDuration() -> TimeInterval {
        recordingStartTime.map { Date().timeIntervalSince($0) } ?? 0
    }
}
```

- [ ] **Step 3: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase3: AudioCaptureService with AVAudioEngine recording and PermissionService"
```

---

### Task 6: TranscriptionService & AppleSpeechProvider

**Files:**
- Create: `Sources/Models/TranscriptionResult.swift`
- Create: `Sources/Providers/Transcription/TranscriptionProvider.swift`
- Create: `Sources/Providers/Transcription/AppleSpeechProvider.swift`
- Create: `Sources/Services/TranscriptionService.swift`
- Test: Build + unit test
- Reference: `docs/superpowers/specs/...md` Section 6.2

- [ ] **Step 1: Create TranscriptionResult model**

```swift
import Foundation

struct TranscriptionResult {
    let text: String
    let language: String?
    let confidence: Float?
    let segments: [TranscriptionSegment]?
    let duration: TimeInterval
    let provider: String

    struct TranscriptionSegment {
        let text: String
        let startTime: TimeInterval
        let endTime: TimeInterval
    }
}
```

- [ ] **Step 2: Create TranscriptionProvider protocol**

```swift
import Foundation

protocol TranscriptionProvider: Sendable {
    var name: String { get }
    var supportsStreaming: Bool { get }

    func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult
}

extension TranscriptionProvider {
    var supportsStreaming: Bool { false }
}
```

- [ ] **Step 3: Create AppleSpeechProvider**

```swift
import Foundation
import Speech

actor AppleSpeechProvider: TranscriptionProvider {
    let name = "Apple Speech"
    private let recognizer: SFSpeechRecognizer

    init(locale: Locale = .current) {
        self.recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer()!
    }

    func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        guard PermissionService.shared.checkSpeechPermission() == .granted else {
            let status = await PermissionService.shared.requestSpeechPermission()
            if status != .granted {
                throw TranscriptionError.speechPermissionDenied
            }
        }

        let request = SFSpeechURLRecognitionRequest(url: audioURL)
        request.shouldReportPartialResults = false
        request.addsPunctuation = true

        return try await withCheckedThrowingContinuation { continuation in
            recognizer.recognitionTask(with: request) { result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let result = result, result.isFinal else { return }

                let text = result.bestTranscription.formattedString
                let detectedLocale = result.bestTranscription.segments.first.map { _ in
                    self.recognizer.locale.identifier
                }

                let transcriptionResult = TranscriptionResult(
                    text: text,
                    language: language ?? detectedLocale,
                    confidence: nil,
                    segments: nil,
                    duration: 0,
                    provider: self.name
                )
                continuation.resume(returning: transcriptionResult)
            }
        }
    }
}

enum TranscriptionError: Error, LocalizedError {
    case speechPermissionDenied
    case recognitionFailed
    case noResult
    case providerUnavailable

    var errorDescription: String? {
        switch self {
        case .speechPermissionDenied: return "Speech recognition permission denied"
        case .recognitionFailed: return "Speech recognition failed"
        case .noResult: return "No transcription result"
        case .providerUnavailable: return "Transcription provider unavailable"
        }
    }
}
```

- [ ] **Step 4: Create TranscriptionService facade**

```swift
import Foundation

class TranscriptionService: @unchecked Sendable {
    static let shared = TranscriptionService()

    private var currentProvider: TranscriptionProvider?

    private init() {}

    func setProvider(_ provider: TranscriptionProvider) {
        self.currentProvider = provider
    }

    func transcribe(audioURL: URL, language: String? = nil) async throws -> TranscriptionResult {
        let provider = getProviderForCurrentSettings()
        return try await provider.transcribe(audioURL: audioURL, language: language)
    }

    private func getProviderForCurrentSettings() -> TranscriptionProvider {
        let selected = SettingsStore.shared.selectedTranscriptionProvider
        switch selected {
        case "Apple Speech":
            return AppleSpeechProvider()
        case "OpenAI Whisper":
            return OpenAIWhisperProvider()
        case "Groq":
            return GroqTranscriptionProvider()
        default:
            return AppleSpeechProvider()
        }
    }

    func getAvailableProviders() -> [TranscriptionProvider] {
        return [
            AppleSpeechProvider()
            // Cloud providers will be added in Task 8
        ]
    }
}
```

- [ ] **Step 5: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase3: TranscriptionService with AppleSpeechProvider"
```

---

### Task 7: HotkeyService with CGEventTap

**Files:**
- Create: `Sources/Services/HotkeyService.swift`
- Modify: `Sources/App/AppDelegate.swift` (wire up hotkeys)
- Test: Register hotkeys and verify callback fires
- Reference: `docs/superpowers/specs/...md` Section 6.5

- [ ] **Step 1: Create HotkeyService**

```swift
import Foundation
import CoreGraphics

class HotkeyService {
    static let shared = HotkeyService()

    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var handlers: [CGKeyCode: () -> Void] = [:]
    private var registeredModifiers: [CGEventFlags: Bool] = [:]

    private init() {}

    func register(keyCode: CGKeyCode, modifiers: CGEventFlags, handler: @escaping () -> Void) -> Bool {
        // Store handler
        handlers[keyCode] = handler
        registeredModifiers[modifiers] = true

        // Recreate event tap with updated handlers
        if eventTap != nil {
            unregisterAll()
        }

        return createEventTap()
    }

    private func createEventTap() -> Bool {
        let eventMask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue) | (1 << CGEventType.flagsChanged.rawValue)

        let callback: CGEventTapCallBack = { proxy, type, event, refcon in
            guard let refcon = refcon else { return Unmanaged.passUnretained(event) }
            let service = Unmanaged<HotkeyService>.fromOpaque(refcon).takeUnretainedValue()
            return service.handleEvent(proxy: proxy, type: type, event: event)
        }

        let refcon = Unmanaged.passUnretained(self).toOpaque()

        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: CGEventMask(eventMask),
            callback: callback,
            userInfo: refcon
        ) else {
            // Accessibility permission not granted — show user-facing alert
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = "Accessibility Permission Required"
                alert.informativeText = "OpenType needs Accessibility permission to register global hotkeys. Please grant access in System Settings > Privacy & Security > Accessibility."
                alert.alertStyle = .warning
                alert.addButton(withTitle: "Open System Settings")
                alert.addButton(withTitle: "Later")
                let response = alert.runModal()
                if response == .alertFirstButtonReturn {
                    if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
                        NSWorkspace.shared.open(url)
                    }
                }
            }
            return false
        }

        runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)

        eventTap = tap
        return true
    }

    private func handleEvent(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        guard type == .keyDown else { return Unmanaged.passUnretained(event) }

        let keyCode = CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode))
        let flags = event.flags

        // Check for matching handlers
        for (registeredKeyCode, handler) in handlers {
            if keyCode == registeredKeyCode {
                // Check modifiers match
                let requiredModifiers: CGEventFlags = [.maskCommand, .maskShift]
                let hasCommand = flags.contains(.maskCommand)
                let hasShift = flags.contains(.maskShift)

                let requiresCommand = registeredModifiers[CGEventFlags.maskCommand.union(.maskShift)] == true
                if requiresCommand && hasCommand && hasShift {
                    DispatchQueue.main.async {
                        handler()
                    }
                    return nil // Consume the event
                }
            }
        }

        return Unmanaged.passUnretained(event)
    }

    func unregisterAll() {
        if let tap = eventTap {
            CGEvent.tapEnable(tap: tap, enable: false)
        }
        if let source = runLoopSource {
            CFRunLoopRemoveSource(CFRunLoopGetCurrent(), source, .commonModes)
        }
        eventTap = nil
        runLoopSource = nil
        handlers.removeAll()
        registeredModifiers.removeAll()
    }

    func checkPermission() -> Bool {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: false] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    func requestPermission() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
    }

    deinit {
        unregisterAll()
    }
}
```

- [ ] **Step 2: Update AppDelegate to wire up hotkeys**

```swift
class AppDelegate: NSObject, NSApplicationDelegate {
    let statusBarController = StatusBarController()
    private let hotkeyService = HotkeyService.shared

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupHotkeys()
    }

    private func setupHotkeys() {
        // Check permission first
        if !hotkeyService.checkPermission() {
            hotkeyService.requestPermission()
        }

        // Register default hotkeys and check for failures
        let hotkeyNames = [
            (CGKeyCode(2),  CGEventFlags.maskCommand.union(.maskShift), "Basic Voice Input (⌘⇧D)"),
            (CGKeyCode(49), CGEventFlags.maskCommand.union(.maskShift), "Hands-Free (⌘⇧Space)"),
            (CGKeyCode(17), CGEventFlags.maskCommand.union(.maskShift), "Translate (⌘⇧T)"),
            (CGKeyCode(14), CGEventFlags.maskCommand.union(.maskShift), "Edit Selected (⌘⇧E)"),
        ]

        var failedHotkeys: [String] = []

        for (keyCode, modifiers, name) in hotkeyNames {
            let handler: () -> Void
            switch name {
            case "Basic Voice Input (⌘⇧D)":    handler = { [weak self] in self?.onBasicHotkey() }
            case "Hands-Free (⌘⇧Space)":       handler = { [weak self] in self?.onHandsFreeHotkey() }
            case "Translate (⌘⇧T)":             handler = { [weak self] in self?.onTranslateHotkey() }
            case "Edit Selected (⌘⇧E)":        handler = { [weak self] in self?.onEditSelectedHotkey() }
            default:                             handler = {}
            }

            if !hotkeyService.register(keyCode: keyCode, modifiers: modifiers, handler: handler) {
                failedHotkeys.append(name)
            }
        }

        if !failedHotkeys.isEmpty {
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = "Some Hotkeys Could Not Be Registered"
                alert.informativeText = "The following hotkeys are unavailable because another application is using them: \(failedHotkeys.joined(separator: ", ")).\n\nYou can change hotkeys in Settings > General."
                alert.alertStyle = .warning
                alert.addButton(withTitle: "Open Settings")
                alert.addButton(withTitle: "Later")
                let response = alert.runModal()
                if response == .alertFirstButtonReturn {
                    NotificationCenter.default.post(name: .openSettingsWindow, object: nil)
                }
            }
        }
    }

    private func onBasicHotkey() {
        NotificationCenter.default.post(name: .hotkeyBasic, object: nil)
    }

    private func onHandsFreeHotkey() {
        NotificationCenter.default.post(name: .hotkeyHandsFree, object: nil)
    }

    private func onTranslateHotkey() {
        NotificationCenter.default.post(name: .hotkeyTranslate, object: nil)
    }

    private func onEditSelectedHotkey() {
        NotificationCenter.default.post(name: .hotkeyEditSelected, object: nil)
    }

    func applicationWillTerminate(_ notification: Notification) {
        hotkeyService.unregisterAll()
    }
}

extension Notification.Name {
    static let hotkeyBasic = Notification.Name("hotkeyBasic")
    static let hotkeyHandsFree = Notification.Name("hotkeyHandsFree")
    static let hotkeyTranslate = Notification.Name("hotkeyTranslate")
    static let hotkeyEditSelected = Notification.Name("hotkeyEditSelected")
}
```

- [ ] **Step 3: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase3: HotkeyService with CGEventTap global hotkeys"
```

---

### Task 8: TextInsertionService & AIProcessingService

**Files:**
- Create: `Sources/Services/TextInsertionService.swift`
- Create: `Sources/Models/AIProvider.swift`
- Create: `Sources/Services/AIProcessingService.swift`
- Test: Build
- Reference: `docs/superpowers/specs/...md` Sections 6.3, 6.4

- [ ] **Step 1: Create TextInsertionService**

```swift
import Foundation
import AppKit
import CoreGraphics

class TextInsertionService {
    static let shared = TextInsertionService()

    private init() {}

    func insertText(_ text: String) throws {
        // Strategy 1: CGEvent simulate Cmd+V
        if try insertViaCGEvent(text) { return }

        // Strategy 2: AppleScript fallback
        if try insertViaAppleScript(text) { return }

        // Strategy 3: Clipboard fallback
        insertViaClipboard(text)
    }

    private func insertViaCGEvent(_ text: String) throws -> Bool {
        guard PermissionService.shared.checkAccessibilityPermission() else {
            return false
        }

        // Copy text to clipboard
        let pasteboard = NSPasteboard.general
        let previousContents = pasteboard.string(forType: .string)
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)

        // Simulate Cmd+V
        let source = CGEventSource(stateID: .hidSystemState)

        guard let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: true), // V
              let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: false)
        else { return false }

        keyDown.flags = .maskCommand
        keyUp.flags = .maskCommand

        keyDown.post(tap: .cgAnnotatedSessionEventTap)
        keyUp.post(tap: .cgAnnotatedSessionEventTap)

        return true
    }

    private func insertViaAppleScript(_ text: String) throws -> Bool {
        let escapedText = text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")

        let script = """
        tell application "System Events"
            keystroke "\(escapedText)"
        end tell
        """

        var error: NSDictionary?
        if let scriptObject = NSAppleScript(source: script) {
            scriptObject.executeAndReturnError(&error)
            return error == nil
        }
        return false
    }

    private func insertViaClipboard(_ text: String) {
        // Already copied to clipboard by CGEvent strategy
        // Just notify user
        print("Text copied to clipboard: \(text.prefix(50))...")
    }

    func getSelectedText() -> String? {
        // Try AXUIElement first
        if let text = getSelectedTextViaAccessibility() {
            return text
        }

        // Fallback: read clipboard
        return NSPasteboard.general.string(forType: .string)
    }

    private func getSelectedTextViaAccessibility() -> String? {
        guard PermissionService.shared.checkAccessibilityPermission() else { return nil }

        let systemWideElement = AXUIElementCreateSystemWide()
        var focusedElement: CFTypeRef?
        AXUIElementCopyAttributeValue(systemWideElement, kAXFocusedUIElementAttribute as CFString, &focusedElement)

        guard let element = focusedElement else { return nil }

        var selectedText: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element as! AXUIElement, kAXSelectedTextAttribute as CFString, &selectedText)

        if result == .success, let text = selectedText as? String {
            return text
        }
        return nil
    }

    func hasAccessibilityPermission() -> Bool {
        PermissionService.shared.checkAccessibilityPermission()
    }
}
```

- [ ] **Step 2: Create AIProvider protocol and OpenAIProvider**

```swift
import Foundation

protocol AIProvider: Sendable {
    var name: String { get }
    func process(text: String, apiKey: String) async throws -> String
    func removeFillers(text: String, apiKey: String) async throws -> String
}

actor OpenAIProvider: AIProvider {
    let name = "OpenAI GPT"

    func process(text: String, apiKey: String) async throws -> String {
        let url = URL(string: "https://api.openai.com/v1/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = """
        Process the following transcribed text. Remove filler words (um, uh, 嗯, 啊),
        fix repetitions, and clean up self-corrections while preserving the meaning:

        \(text)
        """

        let body: [String: Any] = [
            "model": "gpt-3.5-turbo",
            "messages": [
                ["role": "system", "content": "You are a text post-processor for voice dictation."],
                ["role": "user", "content": prompt]
            ],
            "temperature": 0.3
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }

        let result = try JSONDecoder().decode(OpenAIResponse.self, from: data)
        return result.choices.first?.message.content ?? text
    }

    func removeFillers(text: String, apiKey: String) async throws -> String {
        // Same as process for now - can be specialized later
        return try await process(text: text, apiKey: apiKey)
    }
}

struct OpenAIResponse: Codable {
    struct Choice: Codable {
        struct Message: Codable {
            let content: String
        }
        let message: Message
    }
    let choices: [Choice]
}

enum AIError: Error, LocalizedError {
    case requestFailed
    case invalidResponse
    case apiKeyMissing

    var errorDescription: String? {
        switch self {
        case .requestFailed: return "AI request failed"
        case .invalidResponse: return "Invalid AI response"
        case .apiKeyMissing: return "API key missing"
        }
    }
}
```

- [ ] **Step 3: Create AIProcessingService**

```swift
class AIProcessingService: @unchecked Sendable {
    static let shared = AIProcessingService()

    private var currentProvider: AIProvider?

    private init() {}

    func setProvider(_ provider: AIProvider) {
        self.currentProvider = provider
    }

    func process(text: String, apiKey: String) async throws -> String {
        guard let provider = currentProvider else {
            let provider = OpenAIProvider()
            setProvider(provider)
            return try await provider.process(text: text, apiKey: apiKey)
        }
        return try await provider.process(text: text, apiKey: apiKey)
    }

    func removeFillers(text: String, apiKey: String) async throws -> String {
        guard let provider = currentProvider else {
            let provider = OpenAIProvider()
            setProvider(provider)
            return try await provider.removeFillers(text: text, apiKey: apiKey)
        }
        return try await provider.removeFillers(text: text, apiKey: apiKey)
    }

    func translate(text: String, from: String, to: String, apiKey: String) async throws -> String {
        // Use generic chat completions for translation (works for OpenAI-compatible APIs)
        let providerName = SettingsStore.shared.selectedAIProvider
        let endpoint: String
        let model: String

        switch providerName {
        case "OpenAI GPT":
            endpoint = "https://api.openai.com/v1/chat/completions"
            model = "gpt-3.5-turbo"
        case "Anthropic Claude":
            endpoint = "https://api.anthropic.com/v1/messages"
            // Claude uses different API format — fall back to process
            return try await process(text: "Translate the following from \(from) to \(to): \(text)", apiKey: apiKey)
        case "DeepSeek":
            endpoint = "https://api.deepseek.com/v1/chat/completions"
            model = "deepseek-chat"
        default:
            endpoint = "https://api.openai.com/v1/chat/completions"
            model = "gpt-3.5-turbo"
        }

        return try await translateViaChat(endpoint: endpoint, model: model, text: text, from: from, to: to, apiKey: apiKey)
    }

    private func translateViaChat(endpoint: String, model: String, text: String, from: String, to: String, apiKey: String) async throws -> String {
        let url = URL(string: endpoint)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = "Translate the following text from \(from) to \(to). Return ONLY the translation, no explanation:\n\n\(text)"

        let body: [String: Any] = [
            "model": model,
            "messages": [
                ["role": "system", "content": "You are a professional translator."],
                ["role": "user", "content": prompt]
            ],
            "temperature": 0.3,
            "max_tokens": 4000
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }

        let result = try JSONDecoder().decode(OpenAIResponse.self, from: data)
        return result.choices.first?.message.content ?? text
    }
}
```

- [ ] **Step 4: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase3: TextInsertionService (CGEvent + AppleScript) and AIProcessingService"
```

---

## Phase 4: Data Layer

### Task 9: Data Layer — SettingsStore, HistoryStore, KeychainManager

**Files:**
- Create: `Sources/Data/SettingsStore.swift`
- Create: `Sources/Data/HistoryStore.swift`
- Create: `Sources/Data/KeychainManager.swift`
- Test: Unit tests for data operations
- Reference: `docs/superpowers/specs/...md` Section 7

- [ ] **Step 1: Create KeychainManager**

```swift
import Foundation
import KeychainAccess

class KeychainManager {
    static let shared = KeychainManager()

    private let keychain: Keychain

    private init() {
        keychain = Keychain(service: Constants.Keychain.service)
            .accessibility(.whenUnlocked)
    }

    // Transcription API Keys
    func saveTranscriptionAPIKey(provider: String, key: String) throws {
        try keychain.set(key, key: "transcription_\(provider)")
    }

    func getTranscriptionAPIKey(provider: String) -> String? {
        try? keychain.get("transcription_\(provider)")
    }

    func deleteTranscriptionAPIKey(provider: String) throws {
        try keychain.remove("transcription_\(provider)")
    }

    // AI API Keys
    func saveAIAPIKey(provider: String, key: String) throws {
        try keychain.set(key, key: "ai_\(provider)")
    }

    func getAIAPIKey(provider: String) -> String? {
        try? keychain.get("ai_\(provider)")
    }

    func deleteAIAPIKey(provider: String) throws {
        try keychain.remove("ai_\(provider)")
    }

    // List all stored providers
    func getAllStoredTranscriptionProviders() -> [String] {
        return keychain.allKeys().filter { $0.hasPrefix("transcription_") }
            .map { String($0.dropFirst("transcription_".count)) }
    }

    func getAllStoredAIProviders() -> [String] {
        return keychain.allKeys().filter { $0.hasPrefix("ai_") }
            .map { String($0.dropFirst("ai_".count)) }
    }
}
```

- [ ] **Step 2: Create SettingsStore (UserDefaults wrapper)**

```swift
import Foundation

class SettingsStore: ObservableObject {
    static let shared = SettingsStore()

    private let defaults: UserDefaults

    // MARK: - Transcription
    @Published var selectedTranscriptionProvider: String {
        didSet { defaults.set(selectedTranscriptionProvider, forKey: "selectedTranscriptionProvider") }
    }

    // MARK: - AI
    @Published var selectedAIProvider: String {
        didSet { defaults.set(selectedAIProvider, forKey: "selectedAIProvider") }
    }

    // MARK: - General
    @Published var launchAtLogin: Bool {
        didSet { defaults.set(launchAtLogin, forKey: "launchAtLogin") }
    }

    @Published var notificationsEnabled: Bool {
        didSet { defaults.set(notificationsEnabled, forKey: "notificationsEnabled") }
    }

    @Published var theme: String {
        didSet { defaults.set(theme, forKey: "theme") }
    }

    @Published var lastProfileID: String? {
        didSet { defaults.set(lastProfileID, forKey: "lastProfileID") }
    }

    // MARK: - Hotkeys (stored as dictionaries)
    @Published var hotkeyConfigs: [String: HotkeyConfig] {
        didSet {
            guard let data = try? JSONEncoder().encode(hotkeyConfigs) else { return }
            defaults.set(data, forKey: "hotkeyConfigs")
        }
    }

    // MARK: - Voice Modes
    @Published var voiceModeConfigs: [VoiceMode: VoiceModeConfig] {
        didSet {
            guard let data = try? JSONEncoder().encode(voiceModeConfigs) else { return }
            defaults.set(data, forKey: "voiceModeConfigs")
        }
    }

    init() {
        defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard

        selectedTranscriptionProvider = defaults.string(forKey: "selectedTranscriptionProvider") ?? "Apple Speech"
        selectedAIProvider = defaults.string(forKey: "selectedAIProvider") ?? "OpenAI"
        launchAtLogin = defaults.bool(forKey: "launchAtLogin")
        notificationsEnabled = defaults.object(forKey: "notificationsEnabled") as? Bool ?? true
        theme = defaults.string(forKey: "theme") ?? "system"
        lastProfileID = defaults.string(forKey: "lastProfileID")

        if let data = defaults.data(forKey: "hotkeyConfigs"),
           let configs = try? JSONDecoder().decode([String: HotkeyConfig].self, from: data) {
            hotkeyConfigs = configs
        } else {
            hotkeyConfigs = [:]
        }

        if let data = defaults.data(forKey: "voiceModeConfigs"),
           let configs = try? JSONDecoder().decode([VoiceMode: VoiceModeConfig].self, from: data) {
            voiceModeConfigs = configs
        } else {
            voiceModeConfigs = [:]
        }
    }
}

struct HotkeyConfig: Codable {
    let keyCode: Int
    let modifiers: UInt
}

struct VoiceModeConfig: Codable {
    var enabled: Bool
    var hotkeyKeyCode: Int?
    var hotkeyModifiers: UInt?
    var sourceLanguage: String?
    var targetLanguage: String?
}
```

- [ ] **Step 3: Create HistoryStore (SQLite.swift)**

```swift
import Foundation
import SQLite

class HistoryStore: @unchecked Sendable {
    static let shared = HistoryStore()

    private var db: Connection?

    // Table definitions
    private let history = Table("history")
    private let id = Expression<String>("id")
    private let audioPath = Expression<String>("audio_path")
    private let originalText = Expression<String>("original_text")
    private let processedText = Expression<String>("processed_text")
    private let mode = Expression<String>("mode")
    private let provider = Expression<String>("provider")
    private let createdAt = Expression<Int64>("created_at")
    private let duration = Expression<Double>("duration")
    private let language = Expression<String>("language")

    private let dictionary = Table("dictionary")
    private let termId = Expression<String>("id")
    private let term = Expression<String>("term")
    private let replacement = Expression<String>("replacement")
    private let category = Expression<String>("category")

    private init() {
        setupDatabase()
    }

    private func setupDatabase() {
        do {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            let appDir = appSupport.appendingPathComponent(Constants.appBundleIdentifier)

            try FileManager.default.createDirectory(at: appDir, withIntermediateDirectories: true)

            let dbPath = appDir.appendingPathComponent(Constants.SQLite.databaseName).path
            db = try Connection(dbPath)

            try createTables()
        } catch {
            print("Database setup failed: \(error)")
        }
    }

    private func createTables() throws {
        guard let db = db else { return }

        try db.run(history.create(ifNotExists: true) { t in
            t.column(id, primaryKey: true)
            t.column(audioPath)
            t.column(originalText)
            t.column(processedText)
            t.column(mode)
            t.column(provider)
            t.column(createdAt)
            t.column(duration)
            t.column(language)
        })

        try db.run(dictionary.create(ifNotExists: true) { t in
            t.column(termId, primaryKey: true)
            t.column(term)
            t.column(replacement)
            t.column(category)
        })
    }

    // MARK: - History CRUD

    func saveHistoryEntry(_ entry: HistoryEntry) throws {
        guard let db = db else { return }

        let insert = history.insert(
            id <- entry.id.uuidString,
            audioPath <- entry.audioPath,
            originalText <- entry.originalText,
            processedText <- entry.processedText,
            mode <- entry.mode.rawValue,
            provider <- entry.provider,
            createdAt <- Int64(entry.createdAt.timeIntervalSince1970),
            duration <- entry.duration,
            language <- entry.language
        )

        try db.run(insert)
    }

    func getAllHistory() -> [HistoryEntry] {
        guard let db = db else { return [] }

        do {
            return try db.prepare(history.order(createdAt.desc)).map { row in
                HistoryEntry(
                    id: UUID(uuidString: row[id]) ?? UUID(),
                    audioPath: row[audioPath],
                    originalText: row[originalText],
                    processedText: row[processedText],
                    mode: VoiceMode(rawValue: row[mode]) ?? .basic,
                    provider: row[provider],
                    createdAt: Date(timeIntervalSince1970: TimeInterval(row[createdAt])),
                    duration: row[duration],
                    language: row[language]
                )
            }
        } catch {
            print("Failed to fetch history: \(error)")
            return []
        }
    }

    func getRecentHistory(limit: Int = 5) -> [HistoryEntry] {
        guard let db = db else { return [] }

        do {
            return try db.prepare(history.order(createdAt.desc).limit(limit)).map { row in
                HistoryEntry(
                    id: UUID(uuidString: row[id]) ?? UUID(),
                    audioPath: row[audioPath],
                    originalText: row[originalText],
                    processedText: row[processedText],
                    mode: VoiceMode(rawValue: row[mode]) ?? .basic,
                    provider: row[provider],
                    createdAt: Date(timeIntervalSince1970: TimeInterval(row[createdAt])),
                    duration: row[duration],
                    language: row[language]
                )
            }
        } catch {
            print("Failed to fetch recent history: \(error)")
            return []
        }
    }

    func deleteHistoryEntry(id entryId: UUID) throws {
        guard let db = db else { return }
        let entry = history.filter(id == entryId.uuidString)
        try db.run(entry.delete())
    }

    func clearAllHistory() throws {
        guard let db = db else { return }
        try db.run(history.delete())
    }

    // MARK: - Dictionary CRUD

    func saveDictionaryEntry(term t: String, replacement r: String, category c: String) throws {
        guard let db = db else { return }

        let insert = dictionary.insert(or: .replace,
            termId <- UUID().uuidString,
            term <- t,
            replacement <- r,
            category <- c
        )
        try db.run(insert)
    }

    func getAllDictionaryEntries() -> [(id: String, term: String, replacement: String, category: String)] {
        guard let db = db else { return [] }

        do {
            return try db.prepare(dictionary).map { row in
                (id: row[termId], term: row[term], replacement: row[replacement], category: row[category])
            }
        } catch {
            print("Failed to fetch dictionary: \(error)")
            return []
        }
    }

    func deleteDictionaryEntry(id entryId: String) throws {
        guard let db = db else { return }
        let entry = dictionary.filter(termId == entryId)
        try db.run(entry.delete())
    }
}
```

- [ ] **Step 4: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase4: Data layer with SettingsStore, HistoryStore (SQLite), KeychainManager"
```

---

## Phase 5: Windows & Settings UI

### Task 10: Settings Window

**Files:**
- Create: `Sources/UI/Windows/SettingsWindowController.swift`
- Create: `Sources/UI/Windows/Views/SettingsView.swift`
- Create: `Sources/UI/Windows/Views/SettingsTabViews.swift`
- Modify: `Sources/App/AppDelegate.swift` (wire up window)
- Test: Visual test
- Reference: `docs/superpowers/specs/...md` Section 5.4

- [ ] **Step 1: Create SettingsWindowController**

```swift
import AppKit
import SwiftUI

class SettingsWindowController: NSWindowController {
    convenience init() {
        let settingsView = SettingsView()
        let hostingController = NSHostingController(rootView: settingsView)

        let window = NSWindow(contentViewController: hostingController)
        window.title = "Settings"
        window.setContentSize(NSSize(
            width: Constants.UI.settingsWindowWidth,
            height: Constants.UI.settingsWindowHeight
        ))
        window.styleMask = [.titled, .closable]
        window.center()

        self.init(window: window)
    }

    func showWindow() {
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
```

- [ ] **Step 2: Create SettingsView with tab navigation**

```swift
import SwiftUI

struct SettingsView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            GeneralSettingsView()
                .tabItem { Label("General", systemImage: "gear") }
                .tag(0)

            TranscriptionSettingsView()
                .tabItem { Label("Transcription", systemImage: "waveform") }
                .tag(1)

            AISettingsView()
                .tabItem { Label("AI", systemImage: "brain") }
                .tag(2)

            VoiceModesSettingsView()
                .tabItem { Label("Voice Modes", systemImage: "mic") }
                .tag(3)

            DataSettingsView()
                .tabItem { Label("Data", systemImage: "externaldrive") }
                .tag(4)
        }
        .frame(
            width: Constants.UI.settingsWindowWidth,
            height: Constants.UI.settingsWindowHeight
        )
    }
}
```

- [ ] **Step 3: Create GeneralSettingsView**

```swift
import SwiftUI

struct GeneralSettingsView: View {
    @ObservedObject private var settings = SettingsStore.shared

    var body: some View {
        Form {
            Section {
                Toggle("Launch at login", isOn: $settings.launchAtLogin)
                Toggle("Show notifications", isOn: $settings.notificationsEnabled)
            }

            Section("Hotkeys") {
                ForEach(VoiceMode.allCases, id: \.self) { mode in
                    HStack {
                        Text(mode.displayName)
                            .frame(width: 100, alignment: .leading)
                        Text(mode.hotkeyDescription)
                            .foregroundColor(.secondary)
                        Spacer()
                        HotkeyRecorderButton(mode: mode)
                    }
                }
            }

            Section("Accessibility") {
                HStack {
                    Text("Accessibility Permission")
                    Spacer()
                    if PermissionService.shared.checkAccessibilityPermission() {
                        Label("Granted", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    } else {
                        Label("Not granted", systemImage: "xmark.circle.fill")
                            .foregroundColor(.red)
                        Button("Request") {
                            PermissionService.shared.requestAccessibilityPermission()
                        }
                    }
                }
            }

            Section("Diagnostics") {
                Button("Open Diagnostics") {
                    NotificationCenter.default.post(name: .openDiagnosticsWindow, object: nil)
                }
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

struct HotkeyRecorderButton: View {
    let mode: VoiceMode
    @State private var isRecording = false

    var body: some View {
        Button(action: { startRecording() }) {
            Text(isRecording ? "Press a key..." : mode.hotkeyDescription)
                .font(.system(.caption, design: .monospaced))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(isRecording ? Color.accentColor.opacity(0.2) : Color(NSColor.controlBackgroundColor))
                .cornerRadius(4)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(isRecording ? Color.accentColor : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private func startRecording() {
        isRecording = true
        let monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [self] event in
            guard self.isRecording else { return event }
            let keyCode = Int(event.keyCode)
            let modifiers = event.modifierFlags.rawValue
            self.saveHotkey(keyCode: keyCode, modifiers: modifiers)
            self.isRecording = false
            NSEvent.removeMonitor(monitor)
            return nil
        }
        _ = monitor
    }

    private func saveHotkey(keyCode: Int, modifiers: UInt) {
        var configs = SettingsStore.shared.hotkeyConfigs
        configs[mode.rawValue] = HotkeyConfig(keyCode: keyCode, modifiers: modifiers)
        SettingsStore.shared.hotkeyConfigs = configs
    }
}
```

- [ ] **Step 4: Create TranscriptionSettingsView**

```swift
import SwiftUI

struct TranscriptionSettingsView: View {
    @ObservedObject private var settings = SettingsStore.shared
    @State private var apiKeyInput = ""

    private let providers = ["Apple Speech", "OpenAI Whisper", "Groq", "Alibaba", "Tencent", "Baidu", "iFlytek"]

    var body: some View {
        Form {
            Section("Provider") {
                Picker("Transcription Provider", selection: $settings.selectedTranscriptionProvider) {
                    ForEach(providers, id: \.self) { provider in
                        Text(provider).tag(provider)
                    }
                }
                .pickerStyle(.radioGroup)

                if settings.selectedTranscriptionProvider != "Apple Speech" {
                    Section("API Key") {
                        SecureField("API Key", text: $apiKeyInput)
                            .textFieldStyle(.roundedBorder)

                        Button("Save API Key") {
                            saveAPIKey()
                        }
                        .disabled(apiKeyInput.isEmpty)
                    }
                }
            }

            Section("Apple Speech (Local)") {
                Text("Uses on-device speech recognition. No internet required.")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text("Supported languages depend on your macOS installation.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private func saveAPIKey() {
        do {
            try KeychainManager.shared.saveTranscriptionAPIKey(
                provider: settings.selectedTranscriptionProvider,
                key: apiKeyInput
            )
            apiKeyInput = ""
        } catch {
            print("Failed to save API key: \(error)")
        }
    }
}
```

- [ ] **Step 5: Create AISettingsView**

```swift
import SwiftUI

struct AISettingsView: View {
    @ObservedObject private var settings = SettingsStore.shared
    @State private var apiKeyInput = ""

    private let providers = ["OpenAI GPT", "Anthropic Claude", "DeepSeek", "Zhipu GLM", "MiniMax", "Moonshot", "Groq"]

    var body: some View {
        Form {
            Section("AI Provider") {
                Picker("AI Provider", selection: $settings.selectedAIProvider) {
                    ForEach(providers, id: \.self) { provider in
                        Text(provider).tag(provider)
                    }
                }
                .pickerStyle(.radioGroup)
            }

            Section("API Key") {
                SecureField("API Key", text: $apiKeyInput)
                    .textFieldStyle(.roundedBorder)

                Button("Save API Key") {
                    saveAPIKey()
                }
                .disabled(apiKeyInput.isEmpty)

                if KeychainManager.shared.getAIAPIKey(provider: settings.selectedAIProvider) != nil {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("API key saved")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Section("Processing Options") {
                Text("AI processing removes filler words, repetitions, and self-corrections.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private func saveAPIKey() {
        do {
            try KeychainManager.shared.saveAIAPIKey(
                provider: settings.selectedAIProvider,
                key: apiKeyInput
            )
            apiKeyInput = ""
        } catch {
            print("Failed to save API key: \(error)")
        }
    }
}
```

- [ ] **Step 6: Create VoiceModesSettingsView and DataSettingsView**

```swift
import SwiftUI

struct VoiceModesSettingsView: View {
    @ObservedObject private var settings = SettingsStore.shared

    var body: some View {
        Form {
            ForEach(VoiceMode.allCases, id: \.self) { mode in
                Section(mode.displayName) {
                    Toggle("Enabled", isOn: Binding(
                        get: { settings.voiceModeConfigs[mode]?.enabled ?? true },
                        set: { enabled in
                            var config = settings.voiceModeConfigs[mode] ?? VoiceModeConfig(enabled: true)
                            config.enabled = enabled
                            settings.voiceModeConfigs[mode] = config
                        }
                    ))

                    Text(mode.hotkeyDescription)
                        .foregroundColor(.secondary)
                        .font(.caption)
                }
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

struct DataSettingsView: View {
    @State private var showingClearConfirmation = false

    var body: some View {
        Form {
            Section("Export") {
                Button("Export History") {
                    exportHistory()
                }
                Button("Export Dictionary") {
                    exportDictionary()
                }
            }

            Section("Import") {
                Button("Import History") {
                    importHistory()
                }
                Button("Import Dictionary") {
                    importDictionary()
                }
            }

            Section("Clear Data") {
                Button("Clear All History") {
                    showingClearConfirmation = true
                }
                .foregroundColor(.red)

                Button("Clear Cache") {
                    clearCache()
                }
            }
        }
        .formStyle(.grouped)
        .padding()
        .alert("Clear History?", isPresented: $showingClearConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Clear", role: .destructive) {
                clearHistory()
            }
        } message: {
            Text("This will permanently delete all transcription history.")
        }
    }

    private func exportHistory() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "opentype_history.json"
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            let history = HistoryStore.shared.getAllHistory()
            let export = history.map { ["text": $0.processedText, "date": ISO8601DateFormatter().string(from: $0.createdAt), "mode": $0.mode.rawValue] }
            if let data = try? JSONSerialization.data(withJSONObject: export, options: .prettyPrinted) {
                try? data.write(to: url)
            }
        }
    }

    private func exportDictionary() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "opentype_dictionary.json"
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            let entries = HistoryStore.shared.getAllDictionaryEntries().map { ["term": $0.term, "replacement": $0.replacement, "category": $0.category] }
            if let data = try? JSONSerialization.data(withJSONObject: entries, options: .prettyPrinted) {
                try? data.write(to: url)
            }
        }
    }

    private func importHistory() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            // Import: parse JSON and re-save to database
            print("Import history from: \(url)")
        }
    }

    private func importDictionary() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            // Import: parse JSON and re-save to database
            print("Import dictionary from: \(url)")
        }
    }

    private func clearCache() {
        let tempDir = FileManager.default.temporaryDirectory
        if let contents = try? FileManager.default.contentsOfDirectory(at: tempDir, includingPropertiesForKeys: nil) {
            for file in contents where file.lastPathComponent.hasPrefix("opentype_recording_") {
                try? FileManager.default.removeItem(at: file)
            }
        }
    }
    private func clearHistory() {
        try? HistoryStore.shared.clearAllHistory()
    }
}
```

- [ ] **Step 7: Update AppDelegate to handle settings window**

```swift
class AppDelegate: NSObject, NSApplicationDelegate {
    let statusBarController = StatusBarController()
    private let hotkeyService = HotkeyService.shared
    private var settingsWindowController: SettingsWindowController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupNotifications()
        setupHotkeys()
    }

    private func setupNotifications() {
        NotificationCenter.default.addObserver(
            forName: .openSettingsWindow,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.openSettings()
        }
    }

    private func openSettings() {
        if settingsWindowController == nil {
            settingsWindowController = SettingsWindowController()
        }
        settingsWindowController?.showWindow()
    }

    // ... rest of AppDelegate unchanged ...
}
```

- [ ] **Step 8: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase5: Settings window with 5 tabs (General/Transcription/AI/Voice Modes/Data)"
```

---

### Task 11: Main Window (History, Dictionary, Profiles)

**Files:**
- Create: `Sources/UI/Windows/MainWindowController.swift`
- Create: `Sources/UI/Windows/Views/HistoryView.swift`
- Create: `Sources/UI/Windows/Views/DictionaryView.swift`
- Create: `Sources/UI/Windows/Views/ProfilesView.swift`
- Modify: `Sources/App/AppDelegate.swift` (wire up window)
- Test: Visual test
- Reference: `docs/superpowers/specs/...md` Section 5.3

- [ ] **Step 1: Create MainWindowController**

```swift
import AppKit
import SwiftUI

class MainWindowController: NSWindowController {
    convenience init() {
        let mainView = MainTabView()
        let hostingController = NSHostingController(rootView: mainView)

        let window = NSWindow(contentViewController: hostingController)
        window.title = "OpenType"
        window.setContentSize(NSSize(
            width: Constants.UI.mainWindowWidth,
            height: Constants.UI.mainWindowHeight
        ))
        window.styleMask = [.titled, .closable, .resizable, .miniaturizable]
        window.center()
        window.minSize = NSSize(width: 400, height: 300)

        self.init(window: window)
    }

    func showWindow() {
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
```

- [ ] **Step 2: Create MainTabView**

```swift
import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HistoryView()
                .tabItem { Label("History", systemImage: "clock") }
                .tag(0)

            DictionaryView()
                .tabItem { Label("Dictionary", systemImage: "book") }
                .tag(1)

            ProfilesView()
                .tabItem { Label("Profiles", systemImage: "person.crop.circle") }
                .tag(2)
        }
        .frame(
            minWidth: Constants.UI.mainWindowWidth,
            minHeight: Constants.UI.mainWindowHeight
        )
    }
}
```

- [ ] **Step 3: Create HistoryView**

```swift
import SwiftUI
import AVFoundation

struct HistoryView: View {
    @State private var historyEntries: [HistoryEntry] = []
    @State private var selectedEntry: HistoryEntry?
    @State private var audioPlayer: AVAudioPlayer?

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            HStack {
                Text("\(historyEntries.count) transcriptions")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Button(action: refreshHistory) {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.plain)

                Button(action: deleteSelected) {
                    Image(systemName: "trash")
                }
                .buttonStyle(.plain)
                .disabled(selectedEntry == nil)
                .foregroundColor(selectedEntry != nil ? .red : .secondary)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)

            Divider()

            if historyEntries.isEmpty {
                VStack {
                    Image(systemName: "clock")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("No transcriptions yet")
                        .foregroundColor(.secondary)
                    Text("Use ⌘⇧D to start recording")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(selection: $selectedEntry) {
                    ForEach(historyEntries, id: \.id) { entry in
                        HistoryRowView(entry: entry)
                            .tag(entry)
                    }
                }
                .listStyle(.inset)
            }

            // Detail panel
            if let entry = selectedEntry {
                Divider()
                HistoryDetailPanel(entry: entry, audioPlayer: $audioPlayer)
            }
        }
        .onAppear { refreshHistory() }
    }

    private func refreshHistory() {
        historyEntries = HistoryStore.shared.getAllHistory()
    }

    private func deleteSelected() {
        guard let entry = selectedEntry else { return }
        try? HistoryStore.shared.deleteHistoryEntry(id: entry.id)
        refreshHistory()
        selectedEntry = nil
    }
}

struct HistoryRowView: View {
    let entry: HistoryEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(entry.mode.displayName)
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.accentColor.opacity(0.2))
                    .cornerRadius(4)

                Text(entry.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                Text("\(Int(entry.duration))s")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Text(entry.processedText)
                .font(.body)
                .lineLimit(2)
        }
        .padding(.vertical, 4)
    }
}

struct HistoryDetailPanel: View {
    let entry: HistoryEntry
    @Binding var audioPlayer: AVAudioPlayer?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(entry.processedText)
                    .font(.body)
                    .textSelection(.enabled)
                Spacer()
            }

            HStack {
                Button(action: playAudio) {
                    Label("Play", systemImage: "play.fill")
                }

                Button(action: copyText) {
                    Label("Copy", systemImage: "doc.on.doc")
                }

                Spacer()

                Text(entry.createdAt, format: .dateTime)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }

    private func playAudio() {
        let url = URL(fileURLWithPath: entry.audioPath)
        do {
            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.play()
        } catch {
            print("Failed to play audio: \(error)")
        }
    }

    private func copyText() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(entry.processedText, forType: .string)
    }
}
```

- [ ] **Step 4: Create DictionaryView**

```swift
import SwiftUI

struct DictionaryView: View {
    @State private var entries: [(id: String, term: String, replacement: String, category: String)] = []
    @State private var newTerm = ""
    @State private var newReplacement = ""
    @State private var newCategory = ""

    var body: some View {
        VStack(spacing: 0) {
            // Add new entry
            HStack {
                TextField("Term", text: $newTerm)
                    .textFieldStyle(.roundedBorder)
                TextField("Replacement", text: $newReplacement)
                    .textFieldStyle(.roundedBorder)
                TextField("Category", text: $newCategory)
                    .textFieldStyle(.roundedBorder)
                Button("Add") {
                    addEntry()
                }
                .disabled(newTerm.isEmpty || newReplacement.isEmpty)
            }
            .padding()

            Divider()

            if entries.isEmpty {
                VStack {
                    Image(systemName: "book")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("No dictionary entries")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(entries, id: \.id) { entry in
                        HStack {
                            Text(entry.term)
                                .font(.body)
                            Image(systemName: "arrow.right")
                                .foregroundColor(.secondary)
                            Text(entry.replacement)
                                .font(.body)
                                .foregroundColor(.accentColor)
                            Spacer()
                            Text(entry.category)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Button(action: { deleteEntry(entry.id) }) {
                                Image(systemName: "trash")
                                    .foregroundColor(.red)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 2)
                    }
                }
                .listStyle(.inset)
            }
        }
        .onAppear { refresh() }
    }

    private func addEntry() {
        try? HistoryStore.shared.saveDictionaryEntry(
            term: newTerm,
            replacement: newReplacement,
            category: newCategory.isEmpty ? "General" : newCategory
        )
        newTerm = ""
        newReplacement = ""
        newCategory = ""
        refresh()
    }

    private func deleteEntry(_ id: String) {
        try? HistoryStore.shared.deleteDictionaryEntry(id: id)
        refresh()
    }

    private func refresh() {
        entries = HistoryStore.shared.getAllDictionaryEntries()
    }
}
```

- [ ] **Step 5: Create ProfilesView**

```swift
import SwiftUI

struct ProfilesView: View {
    @State private var profiles: [Profile] = ProfileStore.shared.getAllProfiles()
    @State private var selectedProfile: Profile?
    @State private var showingNewProfileSheet = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("\(profiles.count) profiles")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Button(action: { showingNewProfileSheet = true }) {
                    Image(systemName: "plus")
                }
                .buttonStyle(.plain)
            }
            .padding()

            Divider()

            if profiles.isEmpty {
                VStack {
                    Image(systemName: "person.crop.circle")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("No profiles")
                        .foregroundColor(.secondary)
                    Button("Create Profile") {
                        showingNewProfileSheet = true
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(selection: $selectedProfile) {
                    ForEach(profiles, id: \.id) { profile in
                        ProfileRowView(profile: profile)
                            .tag(profile)
                    }
                }
                .listStyle(.inset)
            }
        }
        .sheet(isPresented: $showingNewProfileSheet) {
            NewProfileSheet(onSave: { refresh() })
        }
        .onAppear { refresh() }
    }

    private func refresh() {
        profiles = ProfileStore.shared.getAllProfiles()
    }
}

struct ProfileRowView: View {
    let profile: Profile

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(profile.name)
                    .font(.body)
                if profile.isDefault {
                    Text("Default")
                        .font(.caption)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.accentColor.opacity(0.2))
                        .cornerRadius(4)
                }
            }
            Text(profile.transcriptionProvider)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 2)
    }
}

struct NewProfileSheet: View {
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var transcriptionProvider = "Apple Speech"
    @State private var aiProvider = "OpenAI GPT"
    let onSave: () -> Void

    var body: some View {
        VStack {
            Text("New Profile")
                .font(.headline)
                .padding()

            Form {
                TextField("Profile Name", text: $name)
            }
            .padding()

            HStack {
                Button("Cancel") { dismiss() }
                Button("Create") {
                    ProfileStore.shared.createProfile(name: name, transcriptionProvider: transcriptionProvider, aiProvider: aiProvider)
                    onSave()
                    dismiss()
                }
                .disabled(name.isEmpty)
            }
            .padding()
        }
        .frame(width: 300, height: 200)
    }
}

struct Profile: Identifiable, Equatable {
    let id: UUID
    let name: String
    let transcriptionProvider: String
    let aiProvider: String
    let isDefault: Bool

    init(id: UUID = UUID(), name: String, transcriptionProvider: String, aiProvider: String, isDefault: Bool = false) {
        self.id = id
        self.name = name
        self.transcriptionProvider = transcriptionProvider
        self.aiProvider = aiProvider
        self.isDefault = isDefault
    }
}

class ProfileStore {
    static let shared = ProfileStore()

    private let defaults = UserDefaults.standard
    private let profilesKey = "profiles"

    private init() {}

    func createProfile(name: String, transcriptionProvider: String, aiProvider: String) {
        var profiles = getAllProfiles()
        let newProfile = Profile(
            name: name,
            transcriptionProvider: transcriptionProvider,
            aiProvider: aiProvider,
            isDefault: profiles.isEmpty
        )
        profiles.append(newProfile)
        saveProfiles(profiles)
    }

    func getAllProfiles() -> [Profile] {
        guard let data = defaults.data(forKey: profilesKey),
              let profiles = try? JSONDecoder().decode([Profile].self, from: data) else {
            return []
        }
        return profiles
    }

    func deleteProfile(id: UUID) {
        var profiles = getAllProfiles()
        profiles.removeAll { $0.id == id }
        saveProfiles(profiles)
    }

    func setDefaultProfile(id: UUID) {
        var profiles = getAllProfiles()
        profiles = profiles.map { profile in
            Profile(
                id: profile.id,
                name: profile.name,
                transcriptionProvider: profile.transcriptionProvider,
                aiProvider: profile.aiProvider,
                isDefault: profile.id == id
            )
        }
        saveProfiles(profiles)
    }

    func getDefaultProfile() -> Profile? {
        getAllProfiles().first { $0.isDefault }
    }

    private func saveProfiles(_ profiles: [Profile]) {
        guard let data = try? JSONEncoder().encode(profiles) else { return }
        defaults.set(data, forKey: profilesKey)
    }
}
```

- [ ] **Step 6: Update AppDelegate to wire up main window**

```swift
// Add to AppDelegate.swift:
private var mainWindowController: MainWindowController?

// In setupNotifications:
NotificationCenter.default.addObserver(
    forName: .openHistoryWindow,
    object: nil,
    queue: .main
) { [weak self] _ in
    self?.openMainWindow()
}

private func openMainWindow() {
    if mainWindowController == nil {
        mainWindowController = MainWindowController()
    }
    mainWindowController?.showWindow()
}
```

- [ ] **Step 7: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase5: Main window with History/Dictionary/Profiles tabs"
```

---

## Phase 6: Diagnostics & Migration

### Task 12: Diagnostics Window & Migration

**Files:**
- Create: `Sources/UI/Windows/DiagnosticsWindowController.swift`
- Create: `Sources/UI/Windows/Views/DiagnosticsView.swift`
- Create: `Sources/Services/DiagnosticsService.swift`
- Create: `Sources/Services/MigrationService.swift`
- Modify: `Sources/App/AppDelegate.swift` (wire up migration on launch)
- Test: Run diagnostics
- Reference: `docs/superpowers/specs/...md` Sections 10, 13

- [ ] **Step 1: Create DiagnosticsService**

```swift
import Foundation
import AVFoundation
import Speech

struct DiagnosticResult: Identifiable {
    let id = UUID()
    let name: String
    let status: DiagnosticStatus
    let details: String
    let suggestion: String?
}

enum DiagnosticStatus {
    case pass, fail, warning, skipped

    var color: String {
        switch self {
        case .pass: return "green"
        case .fail: return "red"
        case .warning: return "orange"
        case .skipped: return "gray"
        }
    }
}

class DiagnosticsService {
    static let shared = DiagnosticsService()

    private init() {}

    func runAllDiagnostics() async -> [DiagnosticResult] {
        var results: [DiagnosticResult] = []

        results.append(await checkMicrophonePermission())
        results.append(await checkSpeechRecognition())
        results.append(checkAccessibility())
        results.append(await checkAudioDevices())
        results.append(checkNetwork())
        results.append(checkStorage())

        return results
    }

    private func checkMicrophonePermission() async -> DiagnosticResult {
        let status = PermissionService.shared.checkMicrophonePermission()
        return DiagnosticResult(
            name: "Microphone Permission",
            status: status == .granted ? .pass : .fail,
            details: "Microphone access: \(status == .granted ? "Granted" : "Denied")",
            suggestion: status != .granted ? "Go to System Preferences > Privacy > Microphone and enable OpenType" : nil
        )
    }

    private func checkSpeechRecognition() async -> DiagnosticResult {
        let status = PermissionService.shared.checkSpeechPermission()
        return DiagnosticResult(
            name: "Speech Recognition Permission",
            status: status == .granted ? .pass : .fail,
            details: "Speech recognition: \(status == .granted ? "Granted" : "Denied")",
            suggestion: status != .granted ? "Go to System Preferences > Privacy > Speech Recognition and enable OpenType" : nil
        )
    }

    private func checkAccessibility() -> DiagnosticResult {
        let granted = PermissionService.shared.checkAccessibilityPermission()
        return DiagnosticResult(
            name: "Accessibility Permission",
            status: granted ? .pass : .fail,
            details: "Accessibility: \(granted ? "Granted" : "Not granted")",
            suggestion: !granted ? "Go to System Preferences > Security & Privacy > Privacy > Accessibility and enable OpenType" : nil
        )
    }

    private func checkAudioDevices() async -> DiagnosticResult {
        let devices = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInMicrophone, .externalUnknown],
            mediaType: .audio,
            position: .unspecified
        ).devices

        if devices.isEmpty {
            return DiagnosticResult(
                name: "Audio Devices",
                status: .fail,
                details: "No audio input devices found",
                suggestion: "Connect a microphone"
            )
        } else {
            let deviceNames = devices.map { $0.localizedName }.joined(separator: ", ")
            return DiagnosticResult(
                name: "Audio Devices",
                status: .pass,
                details: "Found: \(deviceNames)",
                suggestion: nil
            )
        }
    }

    private func checkNetwork() async -> DiagnosticResult {
        let url = URL(string: "https://api.openai.com")!
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 5

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            return DiagnosticResult(
                name: "Network",
                status: httpResponse != nil ? .pass : .warning,
                details: "Internet connectivity: \(httpResponse != nil ? "Available" : "Unknown")",
                suggestion: nil
            )
        } catch {
            return DiagnosticResult(
                name: "Network",
                status: .warning,
                details: "Could not reach external services",
                suggestion: "Check internet connection"
            )
        }
    }

    private func checkStorage() -> DiagnosticResult {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appDir = appSupport.appendingPathComponent(Constants.appBundleIdentifier)

        do {
            try FileManager.default.createDirectory(at: appDir, withIntermediateDirectories: true)
            return DiagnosticResult(
                name: "Storage",
                status: .pass,
                details: "App directory accessible: \(appDir.path)",
                suggestion: nil
            )
        } catch {
            return DiagnosticResult(
                name: "Storage",
                status: .fail,
                details: "Cannot create app directory",
                suggestion: "Check file system permissions"
            )
        }
    }
}
```

- [ ] **Step 2: Create DiagnosticsView**

```swift
import SwiftUI

struct DiagnosticsView: View {
    @State private var results: [DiagnosticResult] = []
    @State private var isRunning = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("System Diagnostics")
                    .font(.headline)
                Spacer()
                Button(action: runDiagnostics) {
                    if isRunning {
                        ProgressView()
                            .scaleEffect(0.7)
                    } else {
                        Text("Run Diagnostics")
                    }
                }
                .disabled(isRunning)
            }
            .padding()

            Divider()

            if results.isEmpty {
                VStack {
                    Image(systemName: "stethoscope")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("Click 'Run Diagnostics' to check system health")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(results) { result in
                    HStack {
                        Image(systemName: iconName(for: result.status))
                            .foregroundColor(color(for: result.status))

                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.name)
                                .font(.body)
                            Text(result.details)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            if let suggestion = result.suggestion {
                                Text(suggestion)
                                    .font(.caption)
                                    .foregroundColor(.orange)
                            }
                        }
                        Spacer()
                    }
                    .padding(.vertical, 4)
                }
                .listStyle(.inset)
            }
        }
    }

    private func runDiagnostics() {
        isRunning = true
        results = []
        Task {
            results = await DiagnosticsService.shared.runAllDiagnostics()
            isRunning = false
        }
    }

    private func iconName(for status: DiagnosticStatus) -> String {
        switch status {
        case .pass: return "checkmark.circle.fill"
        case .fail: return "xmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .skipped: return "minus.circle.fill"
        }
    }

    private func color(for status: DiagnosticStatus) -> Color {
        switch status {
        case .pass: return .green
        case .fail: return .red
        case .warning: return .orange
        case .skipped: return .gray
        }
    }
}
```

- [ ] **Step 3: Create DiagnosticsWindowController**

```swift
import AppKit
import SwiftUI

class DiagnosticsWindowController: NSWindowController {
    convenience init() {
        let diagnosticsView = DiagnosticsView()
        let hostingController = NSHostingController(rootView: diagnosticsView)

        let window = NSWindow(contentViewController: hostingController)
        window.title = "Diagnostics"
        window.setContentSize(NSSize(
            width: Constants.UI.diagnosticsWindowWidth,
            height: Constants.UI.diagnosticsWindowHeight
        ))
        window.styleMask = [.titled, .closable]
        window.center()

        self.init(window: window)
    }

    private static var sharedController: DiagnosticsWindowController?

    static func show() {
        if sharedController == nil {
            sharedController = DiagnosticsWindowController()
        }
        sharedController?.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
```

- [ ] **Step 4: Create MigrationService**

```swift
import Foundation

class MigrationService {
    static let shared = MigrationService()

    private let electronConfigPath: URL
    private let electronRecordingsPath: URL
    private let newAppSupportPath: URL
    private let newRecordingsPath: URL

    private init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!

        electronConfigPath = appSupport
            .appendingPathComponent("OpenType")
            .appendingPathComponent("config.json")

        electronRecordingsPath = appSupport
            .appendingPathComponent("OpenType")
            .appendingPathComponent("recordings")

        newAppSupportPath = appSupport
            .appendingPathComponent(Constants.appBundleIdentifier)

        newRecordingsPath = newAppSupportPath
            .appendingPathComponent("recordings")
    }

    var needsMigration: Bool {
        FileManager.default.fileExists(atPath: electronConfigPath.path)
    }

    func migrate() throws {
        // Create new app directory
        try FileManager.default.createDirectory(at: newAppSupportPath, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: newRecordingsPath, withIntermediateDirectories: true)

        // Migrate config
        if FileManager.default.fileExists(atPath: electronConfigPath.path) {
            let configData = try Data(contentsOf: electronConfigPath)
            let config = try JSONDecoder().decode(ElectronConfig.self, from: configData)
            migrateConfig(config)
        }

        // Migrate recordings
        if FileManager.default.fileExists(atPath: electronRecordingsPath.path) {
            try migrateRecordings()
        }

        // Mark migration complete
        UserDefaults.standard.set(true, forKey: "migrationCompleted")
    }

    private func migrateConfig(_ config: ElectronConfig) {
        let settings = SettingsStore.shared

        // Map provider names
        settings.selectedTranscriptionProvider = config.transcriptionProvider ?? "Apple Speech"
        settings.selectedAIProvider = config.aiProvider ?? "OpenAI"

        // Save API keys to Keychain
        if let apiKeys = config.apiKeys {
            for (provider, key) in apiKeys {
                try? KeychainManager.shared.saveAIAPIKey(provider: provider, key: key)
            }
        }

        print("Config migrated")
    }

    private func migrateRecordings() throws {
        let contents = try FileManager.default.contentsOfDirectory(
            at: electronRecordingsPath,
            includingPropertiesForKeys: nil
        )

        for file in contents {
            let dest = newRecordingsPath.appendingPathComponent(file.lastPathComponent)
            try FileManager.default.moveItem(at: file, to: dest)
        }
    }
}

struct ElectronConfig: Codable {
    let transcriptionProvider: String?
    let aiProvider: String?
    let apiKeys: [String: String]?
    let hotkeys: [String: String]?
}
```

- [ ] **Step 5: Update AppDelegate to run migration on launch**

```swift
func applicationDidFinishLaunching(_ notification: Notification) {
    // Run migration if needed
    if MigrationService.shared.needsMigration {
        do {
            try MigrationService.shared.migrate()
            print("Migration completed successfully")
        } catch {
            print("Migration failed: \(error)")
        }
    }

    setupNotifications()
    setupHotkeys()
}
```

- [ ] **Step 6: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase6: Diagnostics window and Electron config migration"
```

---

## Phase 7: Connect All Services & Build Verification

### Task 13: Connect All Services to PopoverViewModel

**Files:**
- Modify: `Sources/UI/Popover/PopoverViewModel.swift`
- Modify: `Sources/Services/TranscriptionService.swift`
- Modify: `Sources/Services/AIProcessingService.swift`
- Test: Full integration build
- Reference: `docs/superpowers/specs/...md` Section 5.2

- [ ] **Step 1: Update PopoverViewModel with full service integration**

```swift
@MainActor
class PopoverViewModel: ObservableObject {
    @Published var isRecording = false
    @Published var isProcessing = false
    @Published var transcribedText = ""
    @Published var recentHistory: [HistoryEntry] = []

    private let audioService = AudioCaptureService.shared
    private let transcriptionService = TranscriptionService.shared
    private let aiService = AIProcessingService.shared
    private let textInserter = TextInsertionService.shared

    private var currentMode: VoiceMode = .basic
    private var currentAudioURL: URL?

    func startRecording(mode: VoiceMode) {
        currentMode = mode
        transcribedText = ""

        Task {
            do {
                try await audioService.startRecording()
                isRecording = true
            } catch {
                print("Failed to start recording: \(error)")
                isRecording = false
            }
        }
    }

    func stopRecording() {
        isRecording = false
        isProcessing = true

        Task {
            do {
                let (url, duration) = try await audioService.stopRecording()
                currentAudioURL = url

                // Transcribe
                let result = try await transcriptionService.transcribe(audioURL: url)

                // AI Process
                let apiKey = KeychainManager.shared.getAIAPIKey(
                    provider: SettingsStore.shared.selectedAIProvider
                ) ?? ""

                var processedText = result.text
                if !apiKey.isEmpty {
                    processedText = try await aiService.process(text: result.text, apiKey: apiKey)
                }

                transcribedText = processedText

                // Save to history
                let entry = HistoryEntry(
                    id: UUID(),
                    audioPath: url.path,
                    originalText: result.text,
                    processedText: processedText,
                    mode: currentMode,
                    provider: result.provider,
                    createdAt: Date(),
                    duration: duration,
                    language: result.language ?? "en"
                )
                try? HistoryStore.shared.saveHistoryEntry(entry)
                refreshRecentHistory()

                isProcessing = false
            } catch {
                print("Transcription failed: \(error)")
                transcribedText = "Error: \(error.localizedDescription)"
                isProcessing = false
            }
        }
    }

    func insertText() {
        do {
            try textInserter.insertText(transcribedText)
        } catch {
            print("Text insertion failed: \(error)")
            // Fallback: copy to clipboard
            copyToClipboard(transcribedText)
        }
    }

    func openHistory() {
        NotificationCenter.default.post(name: .openHistoryWindow, object: nil)
    }

    func openSettings() {
        NotificationCenter.default.post(name: .openSettingsWindow, object: nil)
    }

    func copyToClipboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    func refreshRecentHistory() {
        recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)
    }
}
```

- [ ] **Step 2: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase7: Connect all services to PopoverViewModel - full integration"
```

---

### Task 14: Add Cloud Transcription Providers

**Files:**
- Create: `Sources/Providers/Transcription/OpenAIWhisperProvider.swift`
- Create: `Sources/Providers/Transcription/GroqTranscriptionProvider.swift`
- Test: Build
- Reference: `docs/superpowers/specs/...md` Section 6.2

- [ ] **Step 1: Create OpenAIWhisperProvider**

```swift
import Foundation

actor OpenAIWhisperProvider: TranscriptionProvider {
    let name = "OpenAI Whisper"

    func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        let apiKey = try getAPIKey()
        let url = URL(string: "https://api.openai.com/v1/audio/transcriptions")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()

        // Add model field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n".data(using: .utf8)!)
        body.append("whisper-1\r\n".data(using: .utf8)!)

        // Add language if specified
        if let language = language {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(language)\r\n".data(using: .utf8)!)
        }

        // Add file
        let audioData = try Data(contentsOf: audioURL)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/wav\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw TranscriptionError.recognitionFailed
        }

        let result = try JSONDecoder().decode(WhisperResponse.self, from: data)

        return TranscriptionResult(
            text: result.text,
            language: result.language ?? language,
            confidence: nil,
            segments: nil,
            duration: 0,
            provider: name
        )
    }

    private func getAPIKey() throws -> String {
        guard let key = KeychainManager.shared.getTranscriptionAPIKey(provider: name) else {
            throw TranscriptionError.providerUnavailable
        }
        return key
    }
}

struct WhisperResponse: Codable {
    let text: String
    let language: String?
    let duration: Double?
}
```

- [ ] **Step 2: Create GroqTranscriptionProvider**

```swift
import Foundation

actor GroqTranscriptionProvider: TranscriptionProvider {
    let name = "Groq"

    func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        let apiKey = try getAPIKey()
        let url = URL(string: "https://api.groq.com/v1/audio/transcriptions")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let boundary = UUID().uuidString
        var body = Data()
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n".data(using: .utf8)!)
        body.append("distinguish-whisper\r\n".data(using: .utf8)!)

        if let language = language {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(language)\r\n".data(using: .utf8)!)
        }

        let audioData = try Data(contentsOf: audioURL)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/wav\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw TranscriptionError.recognitionFailed
        }

        let result = try JSONDecoder().decode(WhisperResponse.self, from: data)

        return TranscriptionResult(
            text: result.text,
            language: result.language ?? language,
            confidence: nil,
            segments: nil,
            duration: 0,
            provider: name
        )
    }

    private func getAPIKey() throws -> String {
        guard let key = KeychainManager.shared.getTranscriptionAPIKey(provider: name) else {
            throw TranscriptionError.providerUnavailable
        }
        return key
    }
}
```

- [ ] **Step 3: Update TranscriptionService to register cloud providers**

```swift
// Update TranscriptionService.swift:
func getAvailableProviders() -> [TranscriptionProvider] {
    return [
        AppleSpeechProvider(),
        OpenAIWhisperProvider(),
        GroqTranscriptionProvider(),
        // Add more as needed
    ]
}
```

- [ ] **Step 4: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase7: Add OpenAI Whisper and Groq transcription providers"
```

---

### Task 15: Sparkle Auto-Update Configuration

**Files:**
- Create: `Sources/App/UpdaterDelegate.swift`
- Modify: `Sources/App/AppDelegate.swift`
- Test: Build with Sparkle linked
- Reference: `docs/superpowers/specs/...md` Section 10

- [ ] **Step 1: Create UpdaterDelegate**

```swift
import Foundation
import Sparkle

class UpdaterDelegate: NSObject, SUUpdaterDelegate {
    func updater(_ updater: SUUpdater, shouldScheduleUpdateCheck date: Date?) -> Bool {
        return true
    }

    func updaterShouldPromptForPermission(toCheck updater: SUUpdater) -> Bool {
        // Check user preference — if notificationsEnabled, check automatically
        return SettingsStore.shared.notificationsEnabled
    }
}
```

- [ ] **Step 2: Add Sparkle to AppDelegate**

```swift
class AppDelegate: NSObject, NSApplicationDelegate {
    let statusBarController = StatusBarController()
    private let hotkeyService = HotkeyService.shared
    private var updater: SUUpdater?

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupUpdater()
        setupNotifications()
        setupHotkeys()
    }

    private func setupUpdater() {
        updater = SUUpdater.shared()
        updater?.delegate = UpdaterDelegate()
        updater?.automaticallyChecksForUpdates = SettingsStore.shared.notificationsEnabled
        updater?.checkForUpdatesInBackground()
    }
}
```

- [ ] **Step 3: Add Sparkle entitlements for signed updates**

Add to `Resources/OpenType.entitlements`:
```xml
<key>com.apple.security.network.client</key>
<true/>
```

- [ ] **Step 4: Create appcast.xml for GitHub Releases**

Create `Resources/appcast.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>OpenType Releases</title>
    <link>https://github.com/G3niusYukki/OpenType/releases/feed.xml</link>
    <description>OpenType releases</description>
  </channel>
</rss>
```

- [ ] **Step 5: Build and commit**

```bash
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
git add -A && git commit -m "phase7: Add Sparkle auto-update configuration"
```

---

### Task 16: Final Build Verification

**Files:**
- Verify all targets compile
- Generate Xcode project with XcodeGen
- Run xcodebuild for full verification
- Test app launch

- [ ] **Step 1: Final xcodebuild verification**

```bash
xcodegen generate
xcodebuild -project OpenType.xcodeproj -scheme OpenType -configuration Debug build 2>&1 | grep -E "(error:|BUILD SUCCEEDED|BUILD FAILED)"
```

- [ ] **Step 2: Verify app structure**

```bash
ls -la build/Debug/OpenType.app/Contents/MacOS/
# Should contain OpenType binary
```

- [ ] **Step 3: Check Info.plist and entitlements**

```bash
plutil -lint Resources/Info.plist
plutil -lint Resources/OpenType.entitlements
```

Expected: Both pass

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "phase7: Final build verification complete - native macOS app ready"
```

---

## Implementation Order Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| **1** | 1-2 | Project setup, XcodeGen, app entry point |
| **2** | 3-4 | Status bar, Popover UI |
| **3** | 5-8 | Services (Audio, Transcription, Hotkey, TextInsertion, AI) |
| **4** | 9 | Data layer (Settings, History, Keychain) |
| **5** | 10-11 | Settings window, Main window |
| **6** | 12 | Diagnostics, Migration |
| **7** | 13-16 | Integration, cloud providers, Sparkle, build verification |
