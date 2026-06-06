import Foundation

public actor MoonshotProvider: AIProvider, ProviderHTTPClient {
    public let name = "Moonshot"
    private let baseURL = "https://api.moonshot.cn/v1"
    private let defaultModel = "moonshot-v1-8k"

    public init() {}

    public func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String {
        let body = ChatCompletionRequest(model: model ?? defaultModel, systemPrompt: prompt, userText: text)
        let response: ChatCompletionResponse = try await performJSONPost(
            url: URL(string: "\(baseURL)/chat/completions")!,
            body: body,
            apiKey: apiKey
        )
        return response.firstContent ?? text
    }
}
