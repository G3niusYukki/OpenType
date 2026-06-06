import Foundation

public actor AnthropicProvider: AIProvider, ProviderHTTPClient {
    public let name = "Anthropic Claude"
    private let baseURL = "https://api.anthropic.com/v1"
    private let defaultModel = "claude-3-5-sonnet-20241022"

    public init() {}

    public func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String {
        let body = AnthropicRequest(model: model ?? defaultModel, system: prompt, userText: text)
        let response: AnthropicResponse = try await performJSONPost(
            url: URL(string: "\(baseURL)/messages")!,
            body: body,
            apiKey: apiKey,
            authHeaderName: "x-api-key",
            authPrefix: "",
            extraHeaders: ["anthropic-version": "2023-06-01"]
        )
        if let content = response.content.first, content.type == "text" {
            return content.text
        }
        return text
    }
}

// MARK: - Anthropic-specific request/response

private struct AnthropicRequest: Encodable {
    let model: String
    let maxTokens: Int
    let system: String
    let messages: [Message]
    let temperature: Double

    struct Message: Encodable {
        let role: String
        let content: String
    }

    init(model: String, system: String, userText: String) {
        self.model = model
        self.maxTokens = 4096
        self.system = system
        self.messages = [.init(role: "user", content: userText)]
        self.temperature = 0.3
    }
}

private struct AnthropicResponse: Decodable {
    let content: [ContentBlock]

    struct ContentBlock: Decodable {
        let type: String
        let text: String
    }
}
