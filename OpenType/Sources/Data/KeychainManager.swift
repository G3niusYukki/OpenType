import Foundation
import KeychainAccess
import Utilities

public class KeychainManager {
    public static let shared = KeychainManager()

    private let keychain: Keychain

    private init() {
        keychain = Keychain(service: Constants.Keychain.service)
            .accessibility(.whenUnlocked)
    }

    public func saveTranscriptionAPIKey(provider: String, key: String) throws {
        try keychain.set(key, key: "transcription_\(provider)")
    }

    public func getTranscriptionAPIKey(provider: String) -> String? {
        try? keychain.get("transcription_\(provider)")
    }

    public func deleteTranscriptionAPIKey(provider: String) throws {
        try keychain.remove("transcription_\(provider)")
    }

    public func saveAIAPIKey(provider: String, key: String) throws {
        try keychain.set(key, key: "ai_\(provider)")
    }

    public func getAIAPIKey(provider: String) -> String? {
        try? keychain.get("ai_\(provider)")
    }

    public func deleteAIAPIKey(provider: String) throws {
        try keychain.remove("ai_\(provider)")
    }

    public func getAllStoredTranscriptionProviders() -> [String] {
        return keychain.allKeys().filter { $0.hasPrefix("transcription_") }
            .map { String($0.dropFirst("transcription_".count)) }
    }

    public func getAllStoredAIProviders() -> [String] {
        return keychain.allKeys().filter { $0.hasPrefix("ai_") }
            .map { String($0.dropFirst("ai_".count)) }
    }
}
