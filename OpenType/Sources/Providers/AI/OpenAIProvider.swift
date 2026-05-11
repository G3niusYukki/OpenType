import Foundation

public actor OpenAIProvider: AIProvider {
    public let name = "OpenAI"
    private let baseURL = "https://api.openai.com/v1"

    public init() {}

    public func process(text: String, apiKey: String, model: String?) async throws -> String {
        let url = URL(string: "\(baseURL)/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = """
        Process the following transcribed text:
        1. Remove filler words (um, uh, 嗯, 啊)
        2. Fix repetitions and self-corrections
        3. Auto-format: organize lists, steps, and key points into structured text
        4. Preserve the original meaning and tone

        \(text)
        """

        let body: [String: Any] = [
            "model": model ?? "gpt-4o-mini",
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

        let result = try JSONDecoder().decode(OpenAIResponse.self, from: data)
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
            "model": model ?? "gpt-4o-mini",
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

        let result = try JSONDecoder().decode(OpenAIResponse.self, from: data)
        return result.choices.first?.message.content ?? text
    }
}

public struct OpenAIResponse: Codable {
    public struct Choice: Codable {
        public struct Message: Codable {
            public let content: String
        }
        public let message: Message
    }
    public let choices: [Choice]
}
