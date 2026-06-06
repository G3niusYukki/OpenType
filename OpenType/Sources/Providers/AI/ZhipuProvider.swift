import Foundation

public actor ZhipuProvider: AIProvider, ProviderHTTPClient {
    public let name = "Zhipu GLM"
    private let baseURL = "https://open.bigmodel.cn/api/paas/v4"
    private let defaultModel = "glm-4"

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
