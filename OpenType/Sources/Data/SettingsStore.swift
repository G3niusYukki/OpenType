import Foundation
import SwiftUI
import Models
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

    // MARK: - Init

    private init() {
        defaults = SettingsStore.suite
    }

    private static let suite: UserDefaults = {
        UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
    }()
}
