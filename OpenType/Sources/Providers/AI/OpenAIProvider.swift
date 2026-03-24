import Foundation

public actor OpenAIProvider: AIProvider {
    public let name = "OpenAI GPT"

    public init() {}

    public func process(text: String, apiKey: String) async throws -> String {
        let url = URL(string: "https://api.openai.com/v1/chat/completions")!
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
            "model": "gpt-3.5-turbo",
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

    public func removeFillers(text: String, apiKey: String) async throws -> String {
        return try await process(text: text, apiKey: apiKey)
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
