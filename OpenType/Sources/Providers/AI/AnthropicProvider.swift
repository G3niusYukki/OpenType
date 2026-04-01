import Foundation

public actor AnthropicProvider: AIProvider {
    public let name = "Anthropic Claude"
    private let baseURL = "https://api.anthropic.com/v1"

    public init() {}

    public func process(text: String, apiKey: String, model: String?) async throws -> String {
        let url = URL(string: "\(baseURL)/messages")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("\(apiKey)", forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = """
        Process the following transcribed text. Remove filler words (um, uh, 嗯, 啊),
        fix repetitions, and clean up self-corrections while preserving the meaning:

        \(text)
        """

        let body: [String: Any] = [
            "model": model ?? "claude-3-sonnet-20240229",
            "max_tokens": 4096,
            "messages": [
                ["role": "user", "content": prompt]
            ],
            "temperature": 0.3
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }

        let result = try JSONDecoder().decode(AnthropicResponse.self, from: data)
        if let content = result.content.first, content.type == "text" {
            return content.text
        }
        return text
    }

    public func removeFillers(text: String, apiKey: String, model: String?) async throws -> String {
        return try await process(text: text, apiKey: apiKey, model: model)
    }

    public func translate(text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String {
        let url = URL(string: "\(baseURL)/messages")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("\(apiKey)", forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = "Translate the following text from \(from) to \(to). Return ONLY the translation:\n\n\(text)"

        let body: [String: Any] = [
            "model": model ?? "claude-3-sonnet-20240229",
            "max_tokens": 4096,
            "messages": [
                ["role": "user", "content": prompt]
            ],
            "temperature": 0.3
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }

        let result = try JSONDecoder().decode(AnthropicResponse.self, from: data)
        if let content = result.content.first, content.type == "text" {
            return content.text
        }
        return text
    }
}

private struct AnthropicResponse: Codable {
    let content: [ContentBlock]
    
    struct ContentBlock: Codable {
        let type: String
        let text: String
    }
}
