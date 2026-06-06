import Foundation
@testable import Providers

/// Helpers for creating mock HTTP responses in tests.
enum ProviderTestHelpers {
    /// Create a mock URLSession that uses MockURLProtocol.
    static func mockSession() -> URLSession {
        URLSession(configuration: .mock)
    }

    /// Create a ChatCompletionResponse JSON Data for the given text.
    static func chatCompletionJSON(text: String) -> Data {
        let json = """
        {
            "choices": [{
                "message": {
                    "content": "\(text)"
                }
            }]
        }
        """
        return json.data(using: .utf8)!
    }

    /// Create a mock HTTP 200 response for a URL.
    static func httpResponse(url: URL, statusCode: Int = 200) -> HTTPURLResponse {
        HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: nil, headerFields: nil)!
    }

    /// Register a mock handler that returns a chat completion response for any request containing the URL substring.
    static func mockChatCompletion(for urlSubstring: String, responseText: String) {
        MockURLProtocol.setHandler(for: urlSubstring) { request in
            let data = chatCompletionJSON(text: responseText)
            let response = httpResponse(url: request.url!)
            return (data, response)
        }
    }
}
