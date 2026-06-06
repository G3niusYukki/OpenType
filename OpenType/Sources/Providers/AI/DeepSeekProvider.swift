import Foundation

public actor DeepSeekProvider: AIProvider, ProviderHTTPClient {
    public let name = "DeepSeek"
    private let baseURL = "https://api.deepseek.com/v1"
    private let defaultModel = "deepseek-chat"

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
