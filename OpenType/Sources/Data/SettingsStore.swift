import Foundation
import SwiftUI
import Models
import Utilities

public class SettingsStore: ObservableObject {
    public static let shared = SettingsStore()

    private let defaults: UserDefaults

    // MARK: - Transcription
    @Published public var selectedTranscriptionProvider: String {
        didSet { defaults.set(selectedTranscriptionProvider, forKey: "selectedTranscriptionProvider") }
    }

    // MARK: - AI
    @Published public var selectedAIProvider: String {
        didSet { defaults.set(selectedAIProvider, forKey: "selectedAIProvider") }
    }

    // MARK: - General
    @Published public var launchAtLogin: Bool {
        didSet { defaults.set(launchAtLogin, forKey: "launchAtLogin") }
    }

    @Published public var notificationsEnabled: Bool {
        didSet { defaults.set(notificationsEnabled, forKey: "notificationsEnabled") }
    }

    @Published public var theme: String {
        didSet { defaults.set(theme, forKey: "theme") }
    }

    @Published public var lastProfileID: String? {
        didSet { defaults.set(lastProfileID, forKey: "lastProfileID") }
    }

    // MARK: - Hotkeys
    @Published public var hotkeyConfigs: [String: HotkeyConfig] {
        didSet {
            guard let data = try? JSONEncoder().encode(hotkeyConfigs) else { return }
            defaults.set(data, forKey: "hotkeyConfigs")
        }
    }

    // MARK: - Voice Modes
    @Published public var voiceModeConfigs: [VoiceMode: VoiceModeConfig] {
        didSet {
            guard let data = try? JSONEncoder().encode(voiceModeConfigs) else { return }
            defaults.set(data, forKey: "voiceModeConfigs")
        }
    }

    private init() {
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
