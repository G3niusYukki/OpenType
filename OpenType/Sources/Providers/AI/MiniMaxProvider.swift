import Foundation

public actor MiniMaxProvider: AIProvider {
    public let name = "MiniMax"
    private let baseURL = "https://api.minimax.chat/v1"

    public init() {}

    public func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String {
        let url = URL(string: "\(baseURL)/text/chatcompletion_v2")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "model": model ?? "abab6.5s-chat",
            "messages": [
                ["role": "system", "content": prompt],
                ["role": "user", "content": text]
            ],
            "temperature": 0.3
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }

        let result = try JSONDecoder().decode(MiniMaxResponse.self, from: data)
        return result.choices.first?.message.content ?? text
    }

}

private struct MiniMaxResponse: Codable {
    let choices: [Choice]
    
    struct Choice: Codable {
        let message: Message
    }
    
    struct Message: Codable {
        let content: String
    }
}
