import Foundation
import Utilities

public actor OpenAIProvider: AIProvider, ProviderHTTPClient {
    public let name = "OpenAI"
    private let baseURL = "https://api.openai.com/v1"
    private let defaultModel = "gpt-4o-mini"

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

    nonisolated public func processStreaming(prompt: String, text: String, apiKey: String, model: String?) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let url = URL(string: "\(baseURL)/chat/completions")!
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

                    let body = ChatCompletionRequest(model: model ?? defaultModel, systemPrompt: prompt, userText: text, stream: true)
                    let encoder = JSONEncoder()
                    encoder.keyEncodingStrategy = .convertToSnakeCase
                    request.httpBody = try encoder.encode(body)

                    let (bytes, response) = try await URLSession.shared.bytes(for: request)
                    guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                        throw AIError.requestFailed
                    }

                    var accumulated = ""
                    for try await line in bytes.lines {
                        guard !line.isEmpty else { continue }

                        let events = SSEParser.parse(line + "\n")
                        for event in events {
                            if event.data == "[DONE]" {
                                continuation.finish()
                                return
                            }

                            if let delta = SSEParser.decode(event, as: OpenAIStreamDelta.self),
                               let content = delta.choices.first?.delta.content {
                                accumulated += content
                                continuation.yield(accumulated)
                            }
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}

// MARK: - SSE Streaming Delta

public struct OpenAIStreamDelta: Codable {
    public struct Choice: Codable {
        public struct Delta: Codable {
            public let content: String?
        }
        public let delta: Delta
    }
    public let choices: [Choice]
}
