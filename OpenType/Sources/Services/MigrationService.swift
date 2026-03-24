import Foundation
import Utilities
import Data

public class MigrationService {
    public static let shared = MigrationService()

    private let fileManager = FileManager.default

    private init() {}

    public var needsMigration: Bool {
        let electronConfigPath = electronConfigURL.path
        return fileManager.fileExists(atPath: electronConfigPath)
    }

    private var electronConfigURL: URL {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent("OpenType").appendingPathComponent("config.json")
    }

    private var newAppSupportURL: URL {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent(Constants.appBundleIdentifier)
    }

    private var newRecordingsURL: URL {
        newAppSupportURL.appendingPathComponent("Recordings")
    }

    private var oldRecordingsURL: URL {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent("OpenType").appendingPathComponent("Recordings")
    }

    public func migrate() throws {
        // 1. Create the new app directory
        try fileManager.createDirectory(at: newAppSupportURL, withIntermediateDirectories: true)

        // 2. Migrate config
        if fileManager.fileExists(atPath: electronConfigURL.path) {
            try migrateConfig()
        }

        // 3. Migrate recordings
        if fileManager.fileExists(atPath: oldRecordingsURL.path) {
            try migrateRecordings()
        }

        // 4. Set UserDefaults migration flag
        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        defaults.set(true, forKey: "migrationCompleted")
        defaults.synchronize()
    }

    private func migrateConfig() throws {
        let data = try Data(contentsOf: electronConfigURL)
        let electronConfig = try JSONDecoder().decode(ElectronConfig.self, from: data)

        // Migrate hotkey configs
        var hotkeyConfigs: [String: HotkeyConfig] = [:]
        if let hotkeys = electronConfig.hotkeys {
            for (id, config) in hotkeys {
                hotkeyConfigs[id] = HotkeyConfig(
                    keyCode: config.keyCode,
                    modifiers: config.modifiers,
                    enabled: config.enabled
                )
            }
        }
        if !hotkeyConfigs.isEmpty {
            // Save via SettingsStore if available, otherwise set directly
            let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
            if let encoded = try? JSONEncoder().encode(hotkeyConfigs) {
                defaults.set(encoded, forKey: "hotkeyConfigs")
            }
        }

        // Migrate API keys to keychain
        if let apiKeys = electronConfig.apiKeys {
            for (provider, key) in apiKeys {
                try? KeychainManager.shared.saveTranscriptionAPIKey(provider: provider, key: key)
            }
        }

        // Migrate general settings
        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        if let provider = electronConfig.selectedTranscriptionProvider {
            defaults.set(provider, forKey: Constants.UserDefaults.selectedTranscriptionProvider)
        }
        if let theme = electronConfig.theme {
            defaults.set(theme, forKey: "theme")
        }
        if let launchAtLogin = electronConfig.launchAtLogin {
            defaults.set(launchAtLogin, forKey: Constants.UserDefaults.launchAtLogin)
        }

        defaults.synchronize()
    }

    private func migrateRecordings() throws {
        try fileManager.createDirectory(at: newRecordingsURL, withIntermediateDirectories: true)

        let contents = try fileManager.contentsOfDirectory(
            at: oldRecordingsURL,
            includingPropertiesForKeys: nil,
            options: []
        )

        for fileURL in contents {
            let destinationURL = newRecordingsURL.appendingPathComponent(fileURL.lastPathComponent)
            try? fileManager.copyItem(at: fileURL, to: destinationURL)
        }
    }
}

// MARK: - Electron Config

struct ElectronConfig: Codable {
    let hotkeys: [String: ElectronHotkeyConfig]?
    let apiKeys: [String: String]?
    let selectedTranscriptionProvider: String?
    let selectedAIProvider: String?
    let theme: String?
    let launchAtLogin: Bool?
}

struct ElectronHotkeyConfig: Codable {
    let keyCode: Int
    let modifiers: UInt
    let enabled: Bool
}

struct HotkeyConfig: Codable {
    let keyCode: Int
    let modifiers: UInt
    let enabled: Bool
}
