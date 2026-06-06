@testable import Providers
import XCTest

// MARK: - AI Provider Mock Tests

/// Tests that exercise performJSONPost with MockURLProtocol-injected sessions,
/// covering request encoding, response parsing, headers, and error handling.
final class AIProviderMockTests: XCTestCase {
    override func setUp() {
        super.setUp()
        MockURLProtocol.clearHandlers()
    }

    override func tearDown() {
        MockURLProtocol.clearHandlers()
        super.tearDown()
    }

    // MARK: - ChatCompletionRequest Encoding

    func testChatCompletionRequest_encodesCorrectly() throws {
        let req = ChatCompletionRequest(model: "test-model", systemPrompt: "You are helpful", userText: "Hello")
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(req)
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(json["model"] as? String, "test-model")
        XCTAssertEqual(json["temperature"] as? Double, 0.3)
        XCTAssertNil(json["stream"])

        let messages = try XCTUnwrap(json["messages"] as? [[String: String]])
        XCTAssertEqual(messages.count, 2)
        XCTAssertEqual(messages[0]["role"], "system")
        XCTAssertEqual(messages[0]["content"], "You are helpful")
        XCTAssertEqual(messages[1]["role"], "user")
        XCTAssertEqual(messages[1]["content"], "Hello")
    }

    func testChatCompletionRequest_withStream() throws {
        let req = ChatCompletionRequest(model: "gpt-4", systemPrompt: "sys", userText: "usr", stream: true)
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(req)
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["stream"] as? Bool, true)
    }

    // MARK: - ChatCompletionResponse Parsing

    func testChatCompletionResponse_emptyChoices() throws {
        let json = """
        {"choices": []}
        """.data(using: .utf8)!
        let response = try JSONDecoder().decode(ChatCompletionResponse.self, from: json)
        XCTAssertNil(response.firstContent)
    }

    func testChatCompletionResponse_multipleChoices() throws {
        let json = """
        {"choices": [{"message": {"content": "first"}}, {"message": {"content": "second"}}]}
        """.data(using: .utf8)!
        let response = try JSONDecoder().decode(ChatCompletionResponse.self, from: json)
        XCTAssertEqual(response.firstContent, "first")
        XCTAssertEqual(response.choices.count, 2)
    }

    func testChatCompletionResponse_unicodeContent() throws {
        let data = ProviderTestHelpers.chatCompletionJSON(text: "你好世界 🌍 émojis")
        let response = try JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertEqual(response.firstContent, "你好世界 🌍 émojis")
    }

    // MARK: - performJSONPost with mock session

    func testPerformJSONPost_usesInjectedSession() async throws {
        struct TestClient: ProviderHTTPClient {
            let session: URLSession
        }

        ProviderTestHelpers.mockChatCompletion(for: "example.com", responseText: "mock result")
        let session = ProviderTestHelpers.mockSession()
        let client = TestClient(session: session)

        let body = ChatCompletionRequest(model: "test", systemPrompt: "sys", userText: "usr")
        let response: ChatCompletionResponse = try await client.performJSONPost(
            url: XCTUnwrap(URL(string: "https://example.com/chat/completions")),
            body: body,
            apiKey: "test-key"
        )

        XCTAssertEqual(response.firstContent, "mock result")
    }

    func testPerformJSONPost_sendsCorrectHeaders() async throws {
        struct TestClient: ProviderHTTPClient {
            let session: URLSession
        }

        var capturedRequest: URLRequest?
        MockURLProtocol.setHandler(for: "example.com") { request in
            capturedRequest = request
            let data = ProviderTestHelpers.chatCompletionJSON(text: "ok")
            return (data, ProviderTestHelpers.httpResponse(url: request.url!))
        }

        let client = TestClient(session: ProviderTestHelpers.mockSession())
        let body = ChatCompletionRequest(model: "m", systemPrompt: "s", userText: "u")
        let _: ChatCompletionResponse = try await client.performJSONPost(
            url: XCTUnwrap(URL(string: "https://example.com/v1/chat")),
            body: body,
            apiKey: "sk-test-123"
        )

        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer sk-test-123")
        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertEqual(capturedRequest?.httpMethod, "POST")
    }

    func testPerformJSONPost_httpError_throws() async throws {
        struct TestClient: ProviderHTTPClient {
            let session: URLSession
        }

        MockURLProtocol.setHandler(for: "example.com") { request in
            let data = "error".data(using: .utf8)!
            return (data, ProviderTestHelpers.httpResponse(url: request.url!, statusCode: 500))
        }

        let client = TestClient(session: ProviderTestHelpers.mockSession())
        let body = ChatCompletionRequest(model: "m", systemPrompt: "s", userText: "u")

        do {
            let _: ChatCompletionResponse = try await client.performJSONPost(
                url: XCTUnwrap(URL(string: "https://example.com/v1/chat")),
                body: body,
                apiKey: "key"
            )
            XCTFail("Should have thrown")
        } catch {
            XCTAssertTrue(error is AIError)
        }
    }

    func testPerformJSONPost_customAuthHeader() async throws {
        struct TestClient: ProviderHTTPClient {
            let session: URLSession
        }

        var capturedRequest: URLRequest?
        MockURLProtocol.setHandler(for: "example.com") { request in
            capturedRequest = request
            let data = ProviderTestHelpers.chatCompletionJSON(text: "ok")
            return (data, ProviderTestHelpers.httpResponse(url: request.url!))
        }

        let client = TestClient(session: ProviderTestHelpers.mockSession())
        let body = ChatCompletionRequest(model: "m", systemPrompt: "s", userText: "u")
        let _: ChatCompletionResponse = try await client.performJSONPost(
            url: XCTUnwrap(URL(string: "https://example.com/v1/chat")),
            body: body,
            apiKey: "my-key",
            authHeaderName: "x-api-key",
            authPrefix: "",
            extraHeaders: ["anthropic-version": "2023-06-01"]
        )

        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "x-api-key"), "my-key")
        XCTAssertNil(capturedRequest?.value(forHTTPHeaderField: "Authorization"))
        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "anthropic-version"), "2023-06-01")
    }

    // MARK: - Anthropic-specific

    func testAnthropicRequest_encodesWithSnakeCase() throws {
        struct TestRequest: Encodable {
            let maxTokens: Int
            let system: String
        }
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(TestRequest(maxTokens: 4096, system: "test"))
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["max_tokens"] as? Int, 4096)
        XCTAssertEqual(json["system"] as? String, "test")
    }
}
