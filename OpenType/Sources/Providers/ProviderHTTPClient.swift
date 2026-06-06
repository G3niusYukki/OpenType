import Foundation

// MARK: - Shared HTTP Client for Providers

/// Protocol providing shared HTTP request/response handling for AI and Transcription providers.
/// Adopting types get `performJSONPost`, `performMultipartUpload` for free.
public protocol ProviderHTTPClient: Sendable {
    var session: URLSession { get }
    var decoder: JSONDecoder { get }
}

public extension ProviderHTTPClient {
    var session: URLSession {
        .shared
    }

    var decoder: JSONDecoder {
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
        messages = [
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

public extension ProviderHTTPClient {
    /// Perform a JSON POST request with Bearer token auth.
    func performJSONPost<T: Decodable>(
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

    /// Upload a file via multipart/form-data (used by Transcription providers).
    /// - Parameters:
    ///   - url: API endpoint
    ///   - fields: Form field name→value pairs (e.g., "model": "whisper-1")
    ///   - file: The audio file to upload as a form field
    ///   - apiKey: Auth token
    ///   - authHeaderName: Header name for the token
    ///   - authPrefix: Prefix before the token value (e.g., "Bearer ")
    ///   - extraHeaders: Additional HTTP headers
    func performMultipartUpload<T: Decodable>(
        url: URL,
        fields: [String: String],
        file: (fieldName: String, fileName: String, mimeType: String, data: Data),
        apiKey: String,
        authHeaderName: String = "Authorization",
        authPrefix: String = "Bearer ",
        extraHeaders: [String: String] = [:]
    ) async throws -> T {
        let boundary = UUID().uuidString
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("\(authPrefix)\(apiKey)", forHTTPHeaderField: authHeaderName)
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        for (key, value) in extraHeaders {
            request.setValue(value, forHTTPHeaderField: key)
        }

        var body = Data()

        for (name, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(file.fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(file.mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(file.data)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw TranscriptionError.recognitionFailed
        }

        return try decoder.decode(T.self, from: data)
    }
}
