import Foundation
import Utilities

public actor OpenAIProvider: AIProvider {
    public let name = "OpenAI"
    private let baseURL = "https://api.openai.com/v1"

    public init() {}

    public func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String {
        let url = URL(string: "\(baseURL)/chat/completions")!
        let request = buildRequest(url: url, apiKey: apiKey, model: model ?? "gpt-4o-mini", prompt: prompt, text: text, stream: false)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }

        let result = try JSONDecoder().decode(OpenAIResponse.self, from: data)
        return result.choices.first?.message.content ?? text
    }

    nonisolated public func processStreaming(prompt: String, text: String, apiKey: String, model: String?) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let url = URL(string: "\(baseURL)/chat/completions")!
                    let request = buildRequest(url: url, apiKey: apiKey, model: model ?? "gpt-4o-mini", prompt: prompt, text: text, stream: true)

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

    public func translate(prompt: String, text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String {
        return try await process(prompt: prompt, text: text, apiKey: apiKey, model: model)
    }

    nonisolated private func buildRequest(url: URL, apiKey: String, model: String, prompt: String, text: String, stream: Bool) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = [
            "model": model,
            "messages": [
                ["role": "system", "content": prompt],
                ["role": "user", "content": text]
            ],
            "temperature": 0.3
        ]
        if stream { body["stream"] = true }

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return request
    }
}

// MARK: - Response Types

public struct OpenAIResponse: Codable {
    public struct Choice: Codable {
        public struct Message: Codable {
            public let content: String
        }
        public let message: Message
    }
    public let choices: [Choice]
}

public struct OpenAIStreamDelta: Codable {
    public struct Choice: Codable {
        public struct Delta: Codable {
            public let content: String?
        }
        public let delta: Delta
    }
    public let choices: [Choice]
}
