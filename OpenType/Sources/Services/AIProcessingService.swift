import Foundation
import Providers

public class AIProcessingService: @unchecked Sendable {
    public static let shared = AIProcessingService()

    private init() {}

    public func process(text: String, apiKey: String) async throws -> String {
        let provider = OpenAIProvider()
        return try await provider.process(text: text, apiKey: apiKey)
    }

    public func removeFillers(text: String, apiKey: String) async throws -> String {
        let provider = OpenAIProvider()
        return try await provider.removeFillers(text: text, apiKey: apiKey)
    }

    public func translate(text: String, from: String, to: String, apiKey: String) async throws -> String {
        let url = URL(string: "https://api.openai.com/v1/chat/completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = "Translate the following text from \(from) to \(to). Return ONLY the translation:\n\n\(text)"

        let body: [String: Any] = [
            "model": "gpt-3.5-turbo",
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
