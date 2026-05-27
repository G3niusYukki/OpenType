     1|import Foundation
     2|
     3|public protocol AIProvider: Sendable {
     4|    var name: String { get }
     5|    func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String
     6|    func translate(prompt: String, text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String
     7|
     8|    /// Streaming variant of process(). Yields partial text as it's generated.
     9|    /// Default implementation calls process() and yields the full result once.
    10|    func processStreaming(prompt: String, text: String, apiKey: String, model: String?) -> AsyncThrowingStream<String, Error>
    11|}
    12|
    13|extension AIProvider {
    14|    public func processStreaming(prompt: String, text: String, apiKey: String, model: String?) -> AsyncThrowingStream<String, Error> {
    15|        AsyncThrowingStream { continuation in
    16|            Task {
    17|                do {
    18|                    let result = try await process(prompt: prompt, text: text, apiKey: apiKey, model: model)
    19|                    continuation.yield(result)
    20|                    continuation.finish()
    21|                } catch {
    22|                    continuation.finish(throwing: error)
    23|                }
    24|            }
    25|        }
    26|    }
    27|}
    28|
    29|public enum AIProviderFactory {
    30|    public static func makeProvider(name: String) -> any AIProvider {
    31|        switch name {
    32|        case "OpenAI":
    33|            return OpenAIProvider()
    34|        case "Groq":
    35|            return GroqAIProvider()
    36|        case "Anthropic":
    37|            return AnthropicProvider()
    38|        case "DeepSeek":
    39|            return DeepSeekProvider()
    40|        case "Zhipu":
    41|            return ZhipuProvider()
    42|        case "MiniMax":
    43|            return MiniMaxProvider()
    44|        case "Moonshot":
    45|            return MoonshotProvider()
    46|        default:
    47|            return OpenAIProvider()
    48|        }
    49|    }
    50|
    51|    public static func getAvailableProviders() -> [any AIProvider] {
    52|        return [
    53|            OpenAIProvider(),
    54|            GroqAIProvider(),
    55|            AnthropicProvider(),
    56|            DeepSeekProvider(),
    57|            ZhipuProvider(),
    58|            MiniMaxProvider(),
    59|            MoonshotProvider()
    60|        ]
    61|    }
    62|}
    63|