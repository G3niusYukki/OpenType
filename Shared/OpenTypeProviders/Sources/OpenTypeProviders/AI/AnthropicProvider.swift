     1|import Foundation
     2|
     3|public actor AnthropicProvider: AIProvider {
     4|    public let name = "Anthropic Claude"
     5|    private let baseURL = "https://api.anthropic.com/v1"
     6|
     7|    public init() {}
     8|
     9|    public func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String {
    10|        let url = URL(string: "\(baseURL)/messages")!
    11|        var request = URLRequest(url: url)
    12|        request.httpMethod = "POST"
    13|        request.setValue("\(apiKey)", forHTTPHeaderField: "x-api-key")
    14|        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
    15|        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    16|
    17|        let body: [String: Any] = [
    18|            "model": model ?? "claude-3-sonnet-20240229",
    19|            "max_tokens": 4096,
    20|            "system": prompt,
    21|            "messages": [
    22|                ["role": "user", "content": text]
    23|            ],
    24|            "temperature": 0.3
    25|        ]
    26|
    27|        request.httpBody = try JSONSerialization.data(withJSONObject: body)
    28|
    29|        let (data, response) = try await URLSession.shared.data(for: request)
    30|
    31|        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
    32|            throw AIError.requestFailed
    33|        }
    34|
    35|        let result = try JSONDecoder().decode(AnthropicResponse.self, from: data)
    36|        if let content = result.content.first, content.type == "text" {
    37|            return content.text
    38|        }
    39|        return text
    40|    }
    41|
    42|    public func translate(prompt: String, text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String {
    43|        let url = URL(string: "\(baseURL)/messages")!
    44|        var request = URLRequest(url: url)
    45|        request.httpMethod = "POST"
    46|        request.setValue("\(apiKey)", forHTTPHeaderField: "x-api-key")
    47|        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
    48|        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    49|
    50|        let body: [String: Any] = [
    51|            "model": model ?? "claude-3-sonnet-20240229",
    52|            "max_tokens": 4096,
    53|            "system": prompt,
    54|            "messages": [
    55|                ["role": "user", "content": text]
    56|            ],
    57|            "temperature": 0.3
    58|        ]
    59|
    60|        request.httpBody = try JSONSerialization.data(withJSONObject: body)
    61|
    62|        let (data, response) = try await URLSession.shared.data(for: request)
    63|
    64|        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
    65|            throw AIError.requestFailed
    66|        }
    67|
    68|        let result = try JSONDecoder().decode(AnthropicResponse.self, from: data)
    69|        if let content = result.content.first, content.type == "text" {
    70|            return content.text
    71|        }
    72|        return text
    73|    }
    74|}
    75|
    76|private struct AnthropicResponse: Codable {
    77|    let content: [ContentBlock]
    78|    
    79|    struct ContentBlock: Codable {
    80|        let type: String
    81|        let text: String
    82|    }
    83|}
    84|