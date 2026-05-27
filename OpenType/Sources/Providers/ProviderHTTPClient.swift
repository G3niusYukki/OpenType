import Foundation

// MARK: - Shared HTTP Client for AI Providers

/// Protocol providing shared HTTP request/response handling for AI providers.
/// Adopting types get `performChatCompletion` and `performJSONPost` for free.
public protocol ProviderHTTPClient: Sendable {
    var session: URLSession { get }
    var decoder: JSONDecoder { get }
}

extension ProviderHTTPClient {
    public var session: URLSession { .shared }
    public var decoder: JSONDecoder {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }
}

// MARK: - OpenAI-compatible chat completion

/// Shared request body for OpenAI-compatible chat completion APIs.
public struct ChatCompletionRequest: Encodable {
    public let model: String
    public let messages: [Message]
    public let temperature: Double
    public var stream: Bool?

    public struct Message: Encodable {
        public let role: String
        public let content: String
    }

    public init(model: String, systemPrompt: String, userText: String, temperature: Double = 0.3, stream: Bool? = nil) {
        self.model = model
        self.messages = [
            Message(role: "system", content: systemPrompt),
            Message(role: "user", content: userText),
        ]
        self.temperature = temperature
        self.stream = stream
    }
}

/// Shared response type for OpenAI-compatible APIs.
public struct ChatCompletionResponse: Decodable {
    public let choices: [Choice]

    public struct Choice: Decodable {
        public let message: Message
    }

    public struct Message: Decodable {
        public let content: String
    }

    public var firstContent: String? {
        choices.first?.message.content
    }
}

extension ProviderHTTPClient {

    /// Perform a JSON POST request with Bearer token auth.
    /// Uses `SnakeCase` key strategy for both encoding and decoding.
    public func performJSONPost<T: Decodable>(
        url: URL,
        body: some Encodable,
        apiKey: String,
        authHeaderName: String = "Authorization",
        authPrefix: String = "Bearer ",
        extraHeaders: [String: String] = [:]
    ) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("\(authPrefix)\(apiKey)", forHTTPHeaderField: authHeaderName)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (key, value) in extraHeaders {
            request.setValue(value, forHTTPHeaderField: key)
        }

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }

        return try decoder.decode(T.self, from: data)
    }
}
