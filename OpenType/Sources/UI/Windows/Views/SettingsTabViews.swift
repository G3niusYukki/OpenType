import SwiftUI
import AppKit
import CoreGraphics
import Models
import Data
import Utilities

// MARK: - GeneralSettingsView

struct GeneralSettingsView: View {
    @ObservedObject private var settings = SettingsStore.shared
    @State private var accessibilityGranted = PermissionService.shared.checkAccessibilityPermission()

    private let hotkeyItems: [(id: String, label: String, defaultKeyCode: Int, defaultModifiers: UInt)] = [
        ("basic", "Basic Voice Input", 2,  UInt(CGEventFlags.maskCommand.union(.maskShift).rawValue)),
        ("handsFree", "Hands-Free",    49, UInt(CGEventFlags.maskCommand.union(.maskShift).rawValue)),
        ("translate", "Translate",      17, UInt(CGEventFlags.maskCommand.union(.maskShift).rawValue)),
        ("editSelected", "Edit Selected", 14, UInt(CGEventFlags.maskCommand.union(.maskShift).rawValue)),
    ]

    var body: some View {
        Form {
            Section {
                Toggle("Launch at Login", isOn: $settings.launchAtLogin)
                Toggle("Enable Notifications", isOn: $settings.notificationsEnabled)
            } header: {
                Text("Startup")
            }

            Section {
                ForEach(hotkeyItems, id: \.id) { item in
                    HStack {
                        Text(item.label)
                        Spacer()
                        HotkeyRecorderButton(
                            config: binding(for: item.id),
                            defaultKeyCode: item.defaultKeyCode,
                            defaultModifiers: item.defaultModifiers
                        )
                    }
                }
            } header: {
                Text("Hotkeys")
            }

            Section {
                HStack {
                    Text("Accessibility Permission")
                    Spacer()
                    if accessibilityGranted {
                        Label("Granted", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    } else {
                        Button("Request Access") {
                            PermissionService.shared.requestAccessibilityPermission()
                            accessibilityGranted = PermissionService.shared.checkAccessibilityPermission()
                        }
                    }
                }

                HStack {
                    Spacer()
                    Button("Diagnostics...") {
                        NotificationCenter.default.post(name: .openDiagnosticsWindow, object: nil)
                    }
                }
            } header: {
                Text("System")
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private func binding(for id: String) -> Binding<HotkeyConfig?> {
        Binding(
            get: { settings.hotkeyConfigs[id] },
            set: { newValue in
                if let newValue = newValue {
                    settings.hotkeyConfigs[id] = newValue
                } else {
                    settings.hotkeyConfigs.removeValue(forKey: id)
                }
            }
        )
    }
}

// MARK: - HotkeyRecorderButton

struct HotkeyRecorderButton: View {
    @Binding var config: HotkeyConfig?
    let defaultKeyCode: Int
    let defaultModifiers: UInt

    @State private var isRecording = false
    @State private var eventMonitor: Any?

    var body: some View {
        Button(action: { startRecording() }) {
            Text(displayText)
                .font(.system(.body, design: .monospaced))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(isRecording ? Color.accentColor.opacity(0.2) : Color(nsColor: .controlBackgroundColor))
                .cornerRadius(4)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(isRecording ? Color.accentColor : Color(nsColor: .separatorColor), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .onDisappear {
            stopRecording()
        }
    }

    private var displayText: String {
        if let config = config {
            return formatHotkey(keyCode: config.keyCode, modifiers: config.modifiers)
        }
        return formatHotkey(keyCode: defaultKeyCode, modifiers: defaultModifiers)
    }

    private func startRecording() {
        isRecording = true
        eventMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown]) { event in
            guard isRecording else { return event }
            let keyCode = Int(event.keyCode)
            let modifiers = event.modifierFlags.rawValue & (
                NSEvent.ModifierFlags.deviceIndependentFlagsMask.rawValue
            )
            config = HotkeyConfig(keyCode: keyCode, modifiers: modifiers)
            stopRecording()
            return nil
        }
    }

    private func stopRecording() {
        isRecording = false
        if let monitor = eventMonitor {
            NSEvent.removeMonitor(monitor)
            eventMonitor = nil
        }
    }

    private func formatHotkey(keyCode: Int, modifiers: UInt) -> String {
        var parts: [String] = []
        let flags = NSEvent.ModifierFlags(rawValue: modifiers)
        if flags.contains(.control) { parts.append("^") }
        if flags.contains(.option)  { parts.append("\u{2325}") }
        if flags.contains(.shift)  { parts.append("\u{21E7}") }
        if flags.contains(.command) { parts.append("\u{2318}") }
        parts.append(keyCodeToSymbol(keyCode))
        return parts.joined()
    }

    private func keyCodeToSymbol(_ keyCode: Int) -> String {
        switch keyCode {
        case 0:  return "A"
        case 1:  return "S"
        case 2:  return "D"
        case 3:  return "F"
        case 4:  return "H"
        case 5:  return "G"
        case 6:  return "Z"
        case 7:  return "X"
        case 8:  return "C"
        case 9:  return "V"
        case 11: return "B"
        case 12: return "Q"
        case 13: return "W"
        case 14: return "E"
        case 15: return "R"
        case 16: return "Y"
        case 17: return "T"
        case 18: return "1"
        case 19: return "2"
        case 20: return "3"
        case 21: return "4"
        case 22: return "6"
        case 23: return "5"
        case 24: return "="
        case 25: return "9"
        case 26: return "7"
        case 27: return "-"
        case 28: return "8"
        case 29: return "0"
        case 30: return "]"
        case 31: return "O"
        case 32: return "U"
        case 33: return "["
        case 34: return "I"
        case 35: return "P"
        case 36: return "Return"
        case 37: return "L"
        case 38: return "J"
        case 39: return "'"
        case 40: return "K"
        case 41: return ";"
        case 42: return "\\"
        case 43: return ","
        case 44: return "/"
        case 45: return "N"
        case 46: return "M"
        case 47: return "."
        case 48: return "Tab"
        case 49: return "Space"
        case 51: return "Delete"
        case 53: return "Esc"
        case 96: return "F5"
        case 97: return "F6"
        case 98: return "F7"
        case 99: return "F3"
        case 100: return "F8"
        case 101: return "F9"
        case 103: return "F11"
        case 105: return "F13"
        case 107: return "F14"
        case 109: return "F10"
        case 111: return "F12"
        case 113: return "F15"
        case 118: return "F4"
        case 119: return "F2"
        case 120: return "F1"
        case 121: return "F16"
        default:  return "Key\(keyCode)"
        }
    }
}

// MARK: - TranscriptionSettingsView

struct TranscriptionSettingsView: View {
    @ObservedObject private var settings = SettingsStore.shared
    @State private var apiKeyInput = ""
    @State private var saveStatus: SaveStatus = .idle

    private enum SaveStatus {
        case idle, saved, error
    }

    private let providers = ["Apple Speech", "Whisper", "Deepgram", "AssemblyAI"]

    var body: some View {
        Form {
            Section {
                Picker("Provider", selection: $settings.selectedTranscriptionProvider) {
                    ForEach(providers, id: \.self) { provider in
                        Text(provider).tag(provider)
                    }
                }
                .pickerStyle(.segmented)
            } header: {
                Text("Transcription Provider")
            }

            if settings.selectedTranscriptionProvider != "Apple Speech" {
                Section {
                    SecureField("API Key", text: $apiKeyInput)
                        .textFieldStyle(.roundedBorder)

                    HStack {
                        Button("Save API Key") {
                            saveAPIKey()
                        }
                        .buttonStyle(.borderedProminent)

                        if saveStatus == .saved {
                            Label("Saved", systemImage: "checkmark.circle.fill")
                                .foregroundColor(.green)
                        } else if saveStatus == .error {
                            Label("Error saving key", systemImage: "xmark.circle.fill")
                                .foregroundColor(.red)
                        }
                    }
                } header: {
                    Text("API Key")
                }
            }
        }
        .formStyle(.grouped)
        .padding()
        .onAppear {
            loadAPIKey()
        }
    }

    private func loadAPIKey() {
        apiKeyInput = KeychainManager.shared.getTranscriptionAPIKey(
            provider: settings.selectedTranscriptionProvider
        ) ?? ""
    }

    private func saveAPIKey() {
        do {
            try KeychainManager.shared.saveTranscriptionAPIKey(
                provider: settings.selectedTranscriptionProvider,
                key: apiKeyInput
            )
            saveStatus = .saved
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                saveStatus = .idle
            }
        } catch {
            saveStatus = .error
        }
    }
}

// MARK: - AISettingsView

struct AISettingsView: View {
    @ObservedObject private var settings = SettingsStore.shared
    @State private var apiKeyInput = ""
    @State private var saveStatus: SaveStatus = .idle

    private enum SaveStatus {
        case idle, saved, error
    }

    private let providers = ["OpenAI", "Anthropic", "Google AI"]

    var body: some View {
        Form {
            Section {
                Picker("Provider", selection: $settings.selectedAIProvider) {
                    ForEach(providers, id: \.self) { provider in
                        Text(provider).tag(provider)
                    }
                }
                .pickerStyle(.segmented)
            } header: {
                Text("AI Provider")
            }

            Section {
                SecureField("API Key", text: $apiKeyInput)
                    .textFieldStyle(.roundedBorder)

                HStack {
                    Button("Save API Key") {
                        saveAPIKey()
                    }
                    .buttonStyle(.borderedProminent)

                    if saveStatus == .saved {
                        Label("Saved", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    } else if saveStatus == .error {
                        Label("Error saving key", systemImage: "xmark.circle.fill")
                            .foregroundColor(.red)
                    }
                }
            } header: {
                Text("API Key")
            }
        }
        .formStyle(.grouped)
        .padding()
        .onAppear {
            loadAPIKey()
        }
    }

    private func loadAPIKey() {
        apiKeyInput = KeychainManager.shared.getAIAPIKey(provider: settings.selectedAIProvider) ?? ""
    }

    private func saveAPIKey() {
        do {
            try KeychainManager.shared.saveAIAPIKey(provider: settings.selectedAIProvider, key: apiKeyInput)
            saveStatus = .saved
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                saveStatus = .idle
            }
        } catch {
            saveStatus = .error
        }
    }
}

// MARK: - VoiceModesSettingsView

struct VoiceModesSettingsView: View {
    @ObservedObject private var settings = SettingsStore.shared

    var body: some View {
        Form {
            Section {
                ForEach(VoiceMode.allCases) { mode in
                    Toggle(isOn: enabledBinding(for: mode)) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(mode.displayName)
                                .font(.body)
                            Text(mode.hotkeyDescription)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            } header: {
                Text("Voice Modes")
            } footer: {
                Text("Disable modes you don't use to reduce resource usage.")
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private func enabledBinding(for mode: VoiceMode) -> Binding<Bool> {
        Binding(
            get: {
                settings.voiceModeConfigs[mode]?.enabled ?? true
            },
            set: { newValue in
                var config = settings.voiceModeConfigs[mode] ?? VoiceModeConfig()
                config.enabled = newValue
                settings.voiceModeConfigs[mode] = config
            }
        )
    }
}

// MARK: - DataSettingsView

struct DataSettingsView: View {
    private let historyStore = HistoryStore.shared
    @State private var showClearAlert = false
    @State private var lastExportURL: URL?

    var body: some View {
        Form {
            Section {
                Button("Export History...") {
                    exportHistory()
                }

                Button("Import History...") {
                    importHistory()
                }
            } header: {
                Text("History")
            }

            Section {
                Button("Clear History", role: .destructive) {
                    showClearAlert = true
                }
            } header: {
                Text("Danger Zone")
            } footer: {
                Text("Clearing history removes all recorded transcription entries from the database. This cannot be undone.")
            }
        }
        .formStyle(.grouped)
        .padding()
        .alert("Clear History?", isPresented: $showClearAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Clear", role: .destructive) {
                clearHistory()
            }
        } message: {
            Text("This will permanently delete all transcription history. This action cannot be undone.")
        }
    }

    private func exportHistory() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "opentype-history.json"
        panel.canCreateDirectories = true

        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            let entries = historyStore.getAllHistory()
            do {
                let data = try JSONEncoder().encode(entries)
                try data.write(to: url)
            } catch {
                print("Export failed: \(error)")
            }
        }
    }

    private func importHistory() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false

        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            do {
                let data = try Data(contentsOf: url)
                let entries = try JSONDecoder().decode([HistoryEntry].self, from: data)
                for entry in entries {
                    try historyStore.saveHistoryEntry(entry)
                }
            } catch {
                print("Import failed: \(error)")
            }
        }
    }

    private func clearHistory() {
        do {
            try historyStore.clearAllHistory()
        } catch {
            print("Clear history failed: \(error)")
        }
    }
}
