import Foundation

public actor DeepSeekProvider: AIProvider {
    public let name = "DeepSeek"
    private let baseURL = "https://api.deepseek.com/v1"

    public init() {}

    public func process(text: String, apiKey: String, model: String?) async throws -> String {
        let url = URL(string: "\(baseURL)/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = """
        Process the following transcribed text. Remove filler words (um, uh, 嗯, 啊),
        fix repetitions, and clean up self-corrections while preserving the meaning:

        \(text)
        """

        let body: [String: Any] = [
            "model": model ?? "deepseek-chat",
            "messages": [
                ["role": "system", "content": "You are a text post-processor for voice dictation."],
                ["role": "user", "content": prompt]
            ],
            "temperature": 0.3
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }

        let result = try JSONDecoder().decode(DeepSeekResponse.self, from: data)
        return result.choices.first?.message.content ?? text
    }

    public func removeFillers(text: String, apiKey: String, model: String?) async throws -> String {
        return try await process(text: text, apiKey: apiKey, model: model)
    }

    public func translate(text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String {
        let url = URL(string: "\(baseURL)/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = "Translate the following text from \(from) to \(to). Return ONLY the translation:\n\n\(text)"

        let body: [String: Any] = [
            "model": model ?? "deepseek-chat",
            "messages": [
                ["role": "system", "content": "You are a professional translator."],
                ["role": "user", "content": prompt]
            ],
            "temperature": 0.3
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }

        let result = try JSONDecoder().decode(DeepSeekResponse.self, from: data)
        return result.choices.first?.message.content ?? text
    }
}

private struct DeepSeekResponse: Codable {
    let choices: [Choice]
    
    struct Choice: Codable {
        let message: Message
    }
    
    struct Message: Codable {
        let content: String
    }
}
