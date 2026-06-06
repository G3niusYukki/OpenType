import Foundation
import Models
import SwiftUI
import Utilities

public final class SettingsStore: ObservableObject {
    public static let shared = SettingsStore()

    private let defaults: UserDefaults

    // MARK: - Transcription

    @UserDefault("selectedTranscriptionProvider", defaults: suite)
    public var selectedTranscriptionProvider = "Apple Speech"

    // MARK: - AI

    @UserDefault("selectedAIProvider", defaults: suite)
    public var selectedAIProvider = "OpenAI"

    // MARK: - General

    @UserDefault("launchAtLogin", defaults: suite)
    public var launchAtLogin = false

    @UserDefault("notificationsEnabled", defaults: suite)
    public var notificationsEnabled = true

    @UserDefault("theme", defaults: suite)
    public var theme = "system"

    @UserDefault("lastProfileID", defaults: suite)
    public var lastProfileID: String?

    // MARK: - Hotkeys

    @UserDefault("hotkeyConfigs", defaults: suite)
    public var hotkeyConfigs: [String: HotkeyConfig] = [:]

    // MARK: - Voice Modes

    @UserDefault("voiceModeConfigs", defaults: suite)
    public var voiceModeConfigs: [VoiceMode: VoiceModeConfig] = [:]

    // MARK: - Style

    @UserDefault("suggestedAppTones", defaults: suite)
    public var suggestedAppTones: [String: Date] = [:]

    @UserDefault("recentLocales", defaults: suite)
    public var recentLocales: [String] = [Locale.current.identifier]

    // MARK: - Sound

    @UserDefault("soundFeedbackEnabled", defaults: suite)
    public var soundFeedbackEnabled = true

    // MARK: - Whisper Mode

    @UserDefault("whisperModeEnabled", defaults: suite)
    public var whisperModeEnabled = false

    // MARK: - Whisper.cpp

    @UserDefault("whisperModelPath", defaults: suite)
    public var whisperModelPath: String?

    @UserDefault("whisperBinaryPath", defaults: suite)
    public var whisperBinaryPath: String?

    // MARK: - Onboarding

    @UserDefault("hasCompletedOnboarding", defaults: suite)
    public var hasCompletedOnboarding = false

    // MARK: - Nested Accessors

    public lazy var transcription = TranscriptionSettings(store: self)
    public lazy var ai = AISettings(store: self)
    public lazy var general = GeneralSettings(store: self)
    public lazy var hotkeys = HotkeySettings(store: self)
    public lazy var voiceModes = VoiceModeSettings(store: self)
    public lazy var style = StyleSettings(store: self)
    public lazy var sound = SoundSettings(store: self)
    public lazy var whisper = WhisperSettings(store: self)
    public lazy var onboarding = OnboardingSettings(store: self)

    // MARK: - Init

    private init() {
        defaults = SettingsStore.suite
    }

    private static let suite: UserDefaults = .init(suiteName: Constants.UserDefaults.suiteName) ?? .standard
}

// MARK: - Nested Settings Proxies

// Proxies that group related settings for discoverability.
// Each struct holds an unowned reference back to SettingsStore — the
// actual storage and `@Published` trigger live on the store itself.

public struct TranscriptionSettings {
    private unowned let store: SettingsStore
    init(store: SettingsStore) {
        self.store = store
    }

    public var provider: String {
        get { store.selectedTranscriptionProvider }
        nonmutating set { store.selectedTranscriptionProvider = newValue }
    }
}

public struct AISettings {
    private unowned let store: SettingsStore
    init(store: SettingsStore) {
        self.store = store
    }

    public var provider: String {
        get { store.selectedAIProvider }
        nonmutating set { store.selectedAIProvider = newValue }
    }
}

public struct GeneralSettings {
    private unowned let store: SettingsStore
    init(store: SettingsStore) {
        self.store = store
    }

    public var launchAtLogin: Bool {
        get { store.launchAtLogin }
        nonmutating set { store.launchAtLogin = newValue }
    }

    public var notificationsEnabled: Bool {
        get { store.notificationsEnabled }
        nonmutating set { store.notificationsEnabled = newValue }
    }

    public var theme: String {
        get { store.theme }
        nonmutating set { store.theme = newValue }
    }

    public var lastProfileID: String? {
        get { store.lastProfileID }
        nonmutating set { store.lastProfileID = newValue }
    }
}

public struct HotkeySettings {
    private unowned let store: SettingsStore
    init(store: SettingsStore) {
        self.store = store
    }

    public var configs: [String: HotkeyConfig] {
        get { store.hotkeyConfigs }
        nonmutating set { store.hotkeyConfigs = newValue }
    }
}

public struct VoiceModeSettings {
    private unowned let store: SettingsStore
    init(store: SettingsStore) {
        self.store = store
    }

    public var configs: [VoiceMode: VoiceModeConfig] {
        get { store.voiceModeConfigs }
        nonmutating set { store.voiceModeConfigs = newValue }
    }
}

public struct StyleSettings {
    private unowned let store: SettingsStore
    init(store: SettingsStore) {
        self.store = store
    }

    public var suggestedAppTones: [String: Date] {
        get { store.suggestedAppTones }
        nonmutating set { store.suggestedAppTones = newValue }
    }

    public var recentLocales: [String] {
        get { store.recentLocales }
        nonmutating set { store.recentLocales = newValue }
    }
}

public struct SoundSettings {
    private unowned let store: SettingsStore
    init(store: SettingsStore) {
        self.store = store
    }

    public var feedbackEnabled: Bool {
        get { store.soundFeedbackEnabled }
        nonmutating set { store.soundFeedbackEnabled = newValue }
    }
}

public struct WhisperSettings {
    private unowned let store: SettingsStore
    init(store: SettingsStore) {
        self.store = store
    }

    public var modeEnabled: Bool {
        get { store.whisperModeEnabled }
        nonmutating set { store.whisperModeEnabled = newValue }
    }

    public var modelPath: String? {
        get { store.whisperModelPath }
        nonmutating set { store.whisperModelPath = newValue }
    }

    public var binaryPath: String? {
        get { store.whisperBinaryPath }
        nonmutating set { store.whisperBinaryPath = newValue }
    }
}

public struct OnboardingSettings {
    private unowned let store: SettingsStore
    init(store: SettingsStore) {
        self.store = store
    }

    public var hasCompleted: Bool {
        get { store.hasCompletedOnboarding }
        nonmutating set { store.hasCompletedOnboarding = newValue }
    }
}
