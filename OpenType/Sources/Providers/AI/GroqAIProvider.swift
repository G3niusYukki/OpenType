import Foundation

public actor GroqAIProvider: AIProvider, ProviderHTTPClient {
    public let name = "Groq"
    private let baseURL = "https://api.groq.com/openai/v1"
    private let defaultModel = "llama-3.3-70b-versatile"

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
