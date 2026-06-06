import Foundation

/// Protocol defining the interface for AI post-processing providers.
///
/// Providers transform raw transcription text into polished, natural writing
/// using large language models. Each provider implements API-specific HTTP
/// requests while conforming to this common interface.
///
/// ## Implementing a New Provider
///
/// 1. Create an `actor` that conforms to `AIProvider`
/// 2. Implement `process(prompt:text:apiKey:model:)` for the provider's API
/// 3. The default `translate()` delegates to `process()` — override only if
///    the provider has a dedicated translation endpoint
/// 4. Override `processStreaming()` for real-time word-by-word output
public protocol AIProvider: Sendable {
    /// Human-readable provider name (e.g., "OpenAI", "Anthropic Claude").
    var name: String { get }

    /// Process raw transcription text through the AI model.
    /// - Parameters:
    ///   - prompt: System prompt guiding the AI's behavior
    ///   - text: Raw transcription text to process
    ///   - apiKey: Provider-specific API key from Keychain
    ///   - model: Optional model override; nil uses provider default
    /// - Returns: Polished, natural text
    /// - Throws: `AIError.requestFailed` on HTTP errors
    func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String

    /// Translate text. Default delegates to `process()` with a translation prompt.
    func translate(prompt: String, text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String

    /// Streaming variant. Yields partial text as the AI generates it.
    /// Default calls `process()` and yields the full result once.
    func processStreaming(prompt: String, text: String, apiKey: String, model: String?) -> AsyncThrowingStream<String, Error>
}

public extension AIProvider {
    func translate(prompt: String, text: String, from _: String, to _: String, apiKey: String, model: String?) async throws -> String {
        return try await process(prompt: prompt, text: text, apiKey: apiKey, model: model)
    }

    func processStreaming(prompt: String, text: String, apiKey: String, model: String?) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let result = try await process(prompt: prompt, text: text, apiKey: apiKey, model: model)
                    continuation.yield(result)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}

/// Factory for creating AI provider instances by name.
public enum AIProviderFactory {
    public static func makeProvider(name: String) -> any AIProvider {
        switch name {
        case "OpenAI": return OpenAIProvider()
        case "Groq": return GroqAIProvider()
        case "Anthropic": return AnthropicProvider()
        case "DeepSeek": return DeepSeekProvider()
        case "Zhipu": return ZhipuProvider()
        case "MiniMax": return MiniMaxProvider()
        case "Moonshot": return MoonshotProvider()
        default: return OpenAIProvider()
        }
    }

    public static func getAvailableProviders() -> [any AIProvider] {
        return [
            OpenAIProvider(), GroqAIProvider(), AnthropicProvider(),
            DeepSeekProvider(), ZhipuProvider(), MiniMaxProvider(), MoonshotProvider(),
        ]
    }
}
