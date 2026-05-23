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

    // MARK: - Style
    @Published public var suggestedAppTones: [String: Date] = [:] {
        didSet {
            if let data = try? JSONEncoder().encode(suggestedAppTones) {
                defaults.set(data, forKey: "suggestedAppTones")
            }
        }
    }

    @Published public var recentLocales: [String] = [Locale.current.identifier] {
        didSet { defaults.set(recentLocales, forKey: "recentLocales") }
    }

    // MARK: - Sound
    @Published public var soundFeedbackEnabled: Bool {
        didSet { defaults.set(soundFeedbackEnabled, forKey: "soundFeedbackEnabled") }
    }

    // MARK: - Whisper Mode
    @Published public var whisperModeEnabled: Bool {
        didSet { defaults.set(whisperModeEnabled, forKey: "whisperModeEnabled") }
    }

    // MARK: - Onboarding
    @Published public var hasCompletedOnboarding: Bool {
        didSet { defaults.set(hasCompletedOnboarding, forKey: "hasCompletedOnboarding") }
    }

    private init() {
        defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard

        selectedTranscriptionProvider = defaults.string(forKey: "selectedTranscriptionProvider") ?? "Apple Speech"
        selectedAIProvider = defaults.string(forKey: "selectedAIProvider") ?? "OpenAI"
        launchAtLogin = defaults.bool(forKey: "launchAtLogin")
        notificationsEnabled = defaults.object(forKey: "notificationsEnabled") as? Bool ?? true
        soundFeedbackEnabled = defaults.object(forKey: "soundFeedbackEnabled") as? Bool ?? true
        whisperModeEnabled = defaults.object(forKey: "whisperModeEnabled") as? Bool ?? false
        hasCompletedOnboarding = defaults.object(forKey: "hasCompletedOnboarding") as? Bool ?? false
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

        if let data = defaults.data(forKey: "suggestedAppTones"),
           var decoded = try? JSONDecoder().decode([String: Date].self, from: data) {
            let cutoff = Date().addingTimeInterval(-90 * 24 * 60 * 60)
            decoded = decoded.filter { $0.value > cutoff }
            suggestedAppTones = decoded
        }

        if let locales = defaults.stringArray(forKey: "recentLocales"), !locales.isEmpty {
            recentLocales = locales
        }
    }
}
