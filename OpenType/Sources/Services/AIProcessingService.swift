import Foundation
import Providers
import Data
import Utilities

public class AIProcessingService: @unchecked Sendable {
    public static let shared = AIProcessingService()

    private init() {}

    private func getProvider() -> any AIProvider {
        let providerName = SettingsStore.shared.selectedAIProvider
        return AIProviderFactory.makeProvider(name: providerName)
    }

    private func getAPIKey(for providerName: String) -> String? {
        return KeychainManager.shared.getAIAPIKey(provider: providerName)
    }

    private func getModel(for providerName: String) -> String? {
        // Get custom model from settings if configured
        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        let key = "ai_model_\(providerName)"
        return defaults.string(forKey: key)
    }

    public func process(text: String) async throws -> String {
        let provider = getProvider()
        let providerName = SettingsStore.shared.selectedAIProvider
        
        guard let apiKey = getAPIKey(for: providerName) else {
            throw AIError.apiKeyNotFound
        }
        
        let model = getModel(for: providerName)
        return try await provider.process(text: text, apiKey: apiKey, model: model)
    }

    public func removeFillers(text: String) async throws -> String {
        let provider = getProvider()
        let providerName = SettingsStore.shared.selectedAIProvider
        
        guard let apiKey = getAPIKey(for: providerName) else {
            throw AIError.apiKeyNotFound
        }
        
        let model = getModel(for: providerName)
        return try await provider.removeFillers(text: text, apiKey: apiKey, model: model)
    }

    public func translate(text: String, from: String, to: String) async throws -> String {
        let provider = getProvider()
        let providerName = SettingsStore.shared.selectedAIProvider
        
        guard let apiKey = getAPIKey(for: providerName) else {
            throw AIError.apiKeyNotFound
        }
        
        let model = getModel(for: providerName)
        return try await provider.translate(text: text, from: from, to: to, apiKey: apiKey, model: model)
    }

    public func getAvailableProviders() -> [any AIProvider] {
        return AIProviderFactory.getAvailableProviders()
    }

    public func isAvailable() -> Bool {
        let providerName = SettingsStore.shared.selectedAIProvider
        return getAPIKey(for: providerName) != nil
    }
}

public enum AIError: Error {
    case requestFailed
    case apiKeyNotFound
    case invalidResponse
}
