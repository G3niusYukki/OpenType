import Foundation

public protocol AIProvider: Sendable {
    var name: String { get }
    func process(text: String, apiKey: String, model: String?) async throws -> String
    func removeFillers(text: String, apiKey: String, model: String?) async throws -> String
    func translate(text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String
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
