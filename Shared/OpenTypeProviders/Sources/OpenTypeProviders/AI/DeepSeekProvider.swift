     1|import Foundation
     2|
     3|public actor DeepSeekProvider: AIProvider {
     4|    public let name = "DeepSeek"
     5|    private let baseURL = "https://api.deepseek.com/v1"
     6|
     7|    public init() {}
     8|
     9|    public func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String {
    10|        let url = URL(string: "\(baseURL)/chat/completions")!
    11|        var request = URLRequest(url: url)
    12|        request.httpMethod = "POST"
    13|        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    14|        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    15|
    16|        let body: [String: Any] = [
    17|            "model": model ?? "deepseek-chat",
    18|            "messages": [
    19|                ["role": "system", "content": prompt],
    20|                ["role": "user", "content": text]
    21|            ],
    22|            "temperature": 0.3
    23|        ]
    24|
    25|        request.httpBody = try JSONSerialization.data(withJSONObject: body)
    26|
    27|        let (data, response) = try await URLSession.shared.data(for: request)
    28|
    29|        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
    30|            throw AIError.requestFailed
    31|        }
    32|
    33|        let result = try JSONDecoder().decode(DeepSeekResponse.self, from: data)
    34|        return result.choices.first?.message.content ?? text
    35|    }
    36|
    37|    public func translate(prompt: String, text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String {
    38|        let url = URL(string: "\(baseURL)/chat/completions")!
    39|        var request = URLRequest(url: url)
    40|        request.httpMethod = "POST"
    41|        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    42|        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    43|
    44|        let body: [String: Any] = [
    45|            "model": model ?? "deepseek-chat",
    46|            "messages": [
    47|                ["role": "system", "content": prompt],
    48|                ["role": "user", "content": text]
    49|            ],
    50|            "temperature": 0.3
    51|        ]
    52|
    53|        request.httpBody = try JSONSerialization.data(withJSONObject: body)
    54|
    55|        let (data, response) = try await URLSession.shared.data(for: request)
    56|
    57|        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
    58|            throw AIError.requestFailed
    59|        }
    60|
    61|        let result = try JSONDecoder().decode(DeepSeekResponse.self, from: data)
    62|        return result.choices.first?.message.content ?? text
    63|    }
    64|}
    65|
    66|private struct DeepSeekResponse: Codable {
    67|    let choices: [Choice]
    68|    
    69|    struct Choice: Codable {
    70|        let message: Message
    71|    }
    72|    
    73|    struct Message: Codable {
    74|        let content: String
    75|    }
    76|}
    77|