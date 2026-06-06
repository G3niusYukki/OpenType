import Foundation

public actor MiniMaxProvider: AIProvider, ProviderHTTPClient {
    public let name = "MiniMax"
    private let baseURL = "https://api.minimax.chat/v1"
    private let defaultModel = "abab6.5s-chat"

    public init() {}

    public func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String {
        let body = ChatCompletionRequest(model: model ?? defaultModel, systemPrompt: prompt, userText: text)
        let response: ChatCompletionResponse = try await performJSONPost(
            url: URL(string: "\(baseURL)/text/chatcompletion_v2")!,
            body: body,
            apiKey: apiKey
        )
        return response.firstContent ?? text
    }
}
