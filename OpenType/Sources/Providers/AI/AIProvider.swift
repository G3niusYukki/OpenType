import Foundation

public protocol AIProvider: Sendable {
    var name: String { get }
    func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String
    func translate(prompt: String, text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String

    /// Streaming variant of process(). Yields partial text as it's generated.
    /// Default implementation calls process() and yields the full result once.
    func processStreaming(prompt: String, text: String, apiKey: String, model: String?) -> AsyncThrowingStream<String, Error>
}

extension AIProvider {
    public func processStreaming(prompt: String, text: String, apiKey: String, model: String?) -> AsyncThrowingStream<String, Error> {
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

public enum AIProviderFactory {
    public static func makeProvider(name: String) -> any AIProvider {
        switch name {
        case "OpenAI":
            return OpenAIProvider()
        case "Groq":
            return GroqAIProvider()
        case "Anthropic":
            return AnthropicProvider()
        case "DeepSeek":
            return DeepSeekProvider()
        case "Zhipu":
            return ZhipuProvider()
        case "MiniMax":
            return MiniMaxProvider()
        case "Moonshot":
            return MoonshotProvider()
        default:
            return OpenAIProvider()
        }
    }

    public static func getAvailableProviders() -> [any AIProvider] {
        return [
            OpenAIProvider(),
            GroqAIProvider(),
            AnthropicProvider(),
            DeepSeekProvider(),
            ZhipuProvider(),
            MiniMaxProvider(),
            MoonshotProvider()
        ]
    }
}
