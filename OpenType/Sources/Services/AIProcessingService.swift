import Foundation
import Providers
import Data
import Models
import Utilities

public class AIProcessingService: @unchecked Sendable {
    public static let shared = AIProcessingService()

    private let retryPolicy = RetryPolicy(maxRetries: 2, baseDelay: 1.0)

    private init() {}

    private func getProvider() -> any AIProvider {
        let providerName = SettingsStore.shared.selectedAIProvider
        return AIProviderFactory.makeProvider(name: providerName)
    }

    private func getAPIKey(for providerName: String) -> String? {
        return KeychainManager.shared.getAIAPIKey(provider: providerName)
    }

    private func getModel(for providerName: String) -> String? {
        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        let key = "ai_model_\(providerName)"
        return defaults.string(forKey: key)
    }

    public func process(text: String, appBundleID: String? = nil) async throws -> String {
        let prompt = StyleProfileService.shared.buildSystemPrompt(appBundleID: appBundleID)
        return try await processWithFailover(text: text, appBundleID: appBundleID, prompt: prompt)
    }

    public func processWithPrompt(prompt: String, text: String) async throws -> String {
        let providerName = SettingsStore.shared.selectedAIProvider
        guard let apiKey = getAPIKey(for: providerName) else { throw AIError.apiKeyNotFound }

        let provider = getProvider()
        let model = getModel(for: providerName)

        return try await withRetry {
            try await provider.process(prompt: prompt, text: text, apiKey: apiKey, model: model)
        }
    }

    /// Streaming variant — yields accumulated text as it's generated.
    public func processStreaming(text: String, appBundleID: String? = nil) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                let providerName = SettingsStore.shared.selectedAIProvider
                guard let apiKey = self.getAPIKey(for: providerName) else {
                    continuation.finish(throwing: AIError.apiKeyNotFound)
                    return
                }

                let provider = self.getProvider()
                let model = self.getModel(for: providerName)
                let prompt = StyleProfileService.shared.buildSystemPrompt(appBundleID: appBundleID)

                do {
                    let stream = provider.processStreaming(prompt: prompt, text: text, apiKey: apiKey, model: model)
                    for try await partial in stream {
                        continuation.yield(partial)
                    }
                    continuation.finish()
                } catch {
                    // If streaming fails and error is retryable, fall back to non-streaming
                    if self.retryPolicy.isRetryable(error) {
                        do {
                            let result = try await self.process(text: text, appBundleID: appBundleID)
                            continuation.yield(result)
                            continuation.finish()
                        } catch {
                            continuation.finish(throwing: error)
                        }
                    } else {
                        continuation.finish(throwing: error)
                    }
                }
            }
        }
    }

    public func translate(text: String, from: String, to: String, appBundleID: String? = nil) async throws -> String {
        let providerName = SettingsStore.shared.selectedAIProvider
        guard let apiKey = getAPIKey(for: providerName) else { throw AIError.apiKeyNotFound }

        let provider = getProvider()
        let model = getModel(for: providerName)
        let prompt = StyleProfileService.shared.buildTranslationPrompt(from: from, to: to, appBundleID: appBundleID)

        return try await withRetry {
            try await provider.translate(prompt: prompt, text: text, from: from, to: to, apiKey: apiKey, model: model)
        }
    }

    // MARK: - Quick Answer

    public func answerQuestion(text: String, appBundleID: String? = nil) async throws -> String {
        let prompt = StyleProfileService.shared.buildQuickAnswerPrompt(appBundleID: appBundleID)
        return try await processWithFailover(text: text, appBundleID: appBundleID, prompt: prompt)
    }

    public func answerQuestionStreaming(text: String, appBundleID: String? = nil) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                let providerName = SettingsStore.shared.selectedAIProvider
                guard let apiKey = self.getAPIKey(for: providerName) else {
                    continuation.finish(throwing: AIError.apiKeyNotFound)
                    return
                }

                let provider = self.getProvider()
                let model = self.getModel(for: providerName)
                let prompt = StyleProfileService.shared.buildQuickAnswerPrompt(appBundleID: appBundleID)

                do {
                    let stream = provider.processStreaming(prompt: prompt, text: text, apiKey: apiKey, model: model)
                    for try await partial in stream {
                        continuation.yield(partial)
                    }
                    continuation.finish()
                } catch {
                    if self.retryPolicy.isRetryable(error) {
                        do {
                            let result = try await self.answerQuestion(text: text, appBundleID: appBundleID)
                            continuation.yield(result)
                            continuation.finish()
                        } catch {
                            continuation.finish(throwing: error)
                        }
                    } else {
                        continuation.finish(throwing: error)
                    }
                }
            }
        }
    }

    // MARK: - Retry Logic

    private func withRetry<T>(_ operation: @escaping () async throws -> T) async throws -> T {
        var lastError: Error?
        for attempt in 0...retryPolicy.maxRetries {
            do {
                return try await operation()
            } catch {
                lastError = error
                guard retryPolicy.shouldRetry(attempt: attempt),
                      retryPolicy.isRetryable(error),
                      attempt < retryPolicy.maxRetries else {
                    throw error
                }
                let delay = retryPolicy.delay(for: attempt)
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }
        throw lastError ?? AIError.requestFailed
    }

    /// Try the selected provider first, then cascade to others on failure.
    private func processWithFailover(
        text: String,
        appBundleID: String?,
        prompt: String
    ) async throws -> String {
        let failover = ProviderFailover(selectedProvider: SettingsStore.shared.selectedAIProvider)
        let order = failover.providerOrder()

        for providerName in order {
            guard let apiKey = getAPIKey(for: providerName) else { continue }

            let provider = AIProviderFactory.makeProvider(name: providerName)
            let model = getModel(for: providerName)

            do {
                return try await withRetry {
                    try await provider.process(prompt: prompt, text: text, apiKey: apiKey, model: model)
                }
            } catch {
                if !retryPolicy.isRetryable(error) { throw error }
                // Continue to next provider
                continue
            }
        }

        throw AIError.apiKeyNotFound
    }

    public func getAvailableProviders() -> [any AIProvider] {
        return AIProviderFactory.getAvailableProviders()
    }

    public func isAvailable() -> Bool {
        let providerName = SettingsStore.shared.selectedAIProvider
        return getAPIKey(for: providerName) != nil
    }
}
// Note: AIError is defined in Sources/Providers/AI/AIError.swift (consolidated in Task 0)
// Do NOT re-declare it here.
