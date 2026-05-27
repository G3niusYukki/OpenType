     1|import Foundation
     2|import OpenTypeCore
     3|
     4|public actor OpenAIProvider: AIProvider {
     5|    public let name = "OpenAI"
     6|    private let baseURL = "https://api.openai.com/v1"
     7|
     8|    public init() {}
     9|
    10|    public func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String {
    11|        let url = URL(string: "\(baseURL)/chat/completions")!
    12|        let request = buildRequest(url: url, apiKey: apiKey, model: model ?? "gpt-4o-mini", prompt: prompt, text: text, stream: false)
    13|
    14|        let (data, response) = try await URLSession.shared.data(for: request)
    15|        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
    16|            throw AIError.requestFailed
    17|        }
    18|
    19|        let result = try JSONDecoder().decode(OpenAIResponse.self, from: data)
    20|        return result.choices.first?.message.content ?? text
    21|    }
    22|
    23|    nonisolated public func processStreaming(prompt: String, text: String, apiKey: String, model: String?) -> AsyncThrowingStream<String, Error> {
    24|        AsyncThrowingStream { continuation in
    25|            Task {
    26|                do {
    27|                    let url = URL(string: "\(baseURL)/chat/completions")!
    28|                    let request = buildRequest(url: url, apiKey: apiKey, model: model ?? "gpt-4o-mini", prompt: prompt, text: text, stream: true)
    29|
    30|                    let (bytes, response) = try await URLSession.shared.bytes(for: request)
    31|                    guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
    32|                        throw AIError.requestFailed
    33|                    }
    34|
    35|                    var accumulated = ""
    36|                    for try await line in bytes.lines {
    37|                        guard !line.isEmpty else { continue }
    38|
    39|                        let events = SSEParser.parse(line + "\n")
    40|                        for event in events {
    41|                            if event.data == "[DONE]" {
    42|                                continuation.finish()
    43|                                return
    44|                            }
    45|
    46|                            if let delta = SSEParser.decode(event, as: OpenAIStreamDelta.self),
    47|                               let content = delta.choices.first?.delta.content {
    48|                                accumulated += content
    49|                                continuation.yield(accumulated)
    50|                            }
    51|                        }
    52|                    }
    53|                    continuation.finish()
    54|                } catch {
    55|                    continuation.finish(throwing: error)
    56|                }
    57|            }
    58|        }
    59|    }
    60|
    61|    public func translate(prompt: String, text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String {
    62|        return try await process(prompt: prompt, text: text, apiKey: apiKey, model: model)
    63|    }
    64|
    65|    nonisolated private func buildRequest(url: URL, apiKey: String, model: String, prompt: String, text: String, stream: Bool) -> URLRequest {
    66|        var request = URLRequest(url: url)
    67|        request.httpMethod = "POST"
    68|        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    69|        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    70|
    71|        var body: [String: Any] = [
    72|            "model": model,
    73|            "messages": [
    74|                ["role": "system", "content": prompt],
    75|                ["role": "user", "content": text]
    76|            ],
    77|            "temperature": 0.3
    78|        ]
    79|        if stream { body["stream"] = true }
    80|
    81|        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    82|        return request
    83|    }
    84|}
    85|
    86|// MARK: - Response Types
    87|
    88|public struct OpenAIResponse: Codable {
    89|    public struct Choice: Codable {
    90|        public struct Message: Codable {
    91|            public let content: String
    92|        }
    93|        public let message: Message
    94|    }
    95|    public let choices: [Choice]
    96|}
    97|
    98|public struct OpenAIStreamDelta: Codable {
    99|    public struct Choice: Codable {
   100|        public struct Delta: Codable {
   101|            public let content: String?
   102|        }
   103|        public let delta: Delta
   104|    }
   105|    public let choices: [Choice]
   106|}
   107|