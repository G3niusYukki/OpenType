import Foundation
import Utilities
import Data

// Local migration target type mirroring Data.HotkeyConfig (keyCode + modifiers only, no enabled)
// The 'enabled' field from Electron config is not migrated as hotkeys are controlled natively.
private struct MigratedHotkeyConfig: Codable {
    let keyCode: Int
    let modifiers: UInt
}

public class MigrationService {
    public static let shared = MigrationService()

    private let fileManager = FileManager.default

    private init() {}

    public var needsMigration: Bool {
        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        guard !defaults.bool(forKey: "migrationCompleted") else { return false }
        return fileManager.fileExists(atPath: electronConfigURL.path)
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

        // 5. Delete the old Electron config file
        try? fileManager.removeItem(at: electronConfigURL)
    }

    private func migrateConfig() throws {
        let data = try Data(contentsOf: electronConfigURL)
        let electronConfig = try JSONDecoder().decode(ElectronConfig.self, from: data)

        // Migrate hotkey configs
        var hotkeyConfigs: [String: MigratedHotkeyConfig] = [:]
        if let hotkeys = electronConfig.hotkeys {
            for (id, config) in hotkeys {
                hotkeyConfigs[id] = MigratedHotkeyConfig(
                    keyCode: config.keyCode,
                    modifiers: config.modifiers
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
            do {
                try fileManager.copyItem(at: fileURL, to: destinationURL)
            } catch {
                print("Failed to migrate recording \(fileURL.lastPathComponent): \(error)")
            }
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
