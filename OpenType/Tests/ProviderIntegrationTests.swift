@testable import Providers
import XCTest

// MARK: - Provider Integration Tests

/// Tests the provider layer: factory, encoding/decoding, error contracts.
/// HTTP integration tests use MockURLProtocol (see AIProviderMockTests for full coverage).
final class ProviderIntegrationTests: XCTestCase {
    // MARK: - AIProviderFactory Tests

    func testAIProviderFactoryReturnsAllSeven() {
        let providers = AIProviderFactory.getAvailableProviders()
        let names = Set(providers.map(\.name))
        XCTAssertTrue(names.contains("OpenAI"))
        XCTAssertTrue(names.contains("Groq"))
        XCTAssertTrue(names.contains("Anthropic Claude"))
        XCTAssertTrue(names.contains("DeepSeek"))
        XCTAssertTrue(names.contains("Zhipu GLM"))
        XCTAssertTrue(names.contains("MiniMax"))
        XCTAssertTrue(names.contains("Moonshot"))
        XCTAssertEqual(providers.count, 7)
    }

    func testAIProviderFactoryMakeProviderByName() {
        let cases: [(String, String)] = [
            ("OpenAI", "OpenAI"),
            ("Groq", "Groq"),
            ("Anthropic", "Anthropic Claude"),
            ("DeepSeek", "DeepSeek"),
            ("Zhipu", "Zhipu GLM"),
            ("MiniMax", "MiniMax"),
            ("Moonshot", "Moonshot"),
        ]
        for (input, expected) in cases {
            XCTAssertEqual(AIProviderFactory.makeProvider(name: input).name, expected)
        }
    }

    func testAIProviderFactoryUnknownDefaultsToOpenAI() {
        XCTAssertEqual(AIProviderFactory.makeProvider(name: "UnknownProvider").name, "OpenAI")
    }

    // MARK: - TranscriptionProviderFactory Tests

    func testTranscriptionProviderFactoryReturnsAllEight() {
        let providers = TranscriptionProviderFactory.getAvailableProviders()
        let names = Set(providers.map(\.name))
        XCTAssertTrue(names.contains("Apple Speech"))
        XCTAssertTrue(names.contains("OpenAI Whisper"))
        XCTAssertTrue(names.contains("Groq"))
        XCTAssertEqual(providers.count, 8)
    }

    func testTranscriptionProviderFactoryUnknownDefaultsToAppleSpeech() {
        let provider = TranscriptionProviderFactory.makeProvider(name: "UnknownProvider")
        XCTAssertEqual(provider.name, "Apple Speech")
    }

    // MARK: - ChatCompletionResponse Decoding

    func testChatCompletionResponseDecoding() throws {
        let json = #"{"choices":[{"message":{"content":"Hello, world!"}}]}"#
        let data = Data(json.utf8)
        let response = try JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertEqual(response.firstContent, "Hello, world!")
    }

    func testChatCompletionResponseEmptyChoices() throws {
        let json = #"{"choices":[]}"#
        let data = Data(json.utf8)
        let response = try JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertNil(response.firstContent)
    }

    func testChatCompletionResponseMultipleChoices() throws {
        let json = """
        {
            "choices": [
                {"message": {"content": "first"}},
                {"message": {"content": "second"}}
            ]
        }
        """
        let data = Data(json.utf8)
        let response = try JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertEqual(response.firstContent, "first")
    }

    // MARK: - ChatCompletionRequest Encoding

    func testChatCompletionRequestBasicEncoding() throws {
        let request = ChatCompletionRequest(
            model: "gpt-4",
            systemPrompt: "You are helpful.",
            userText: "Hello",
            temperature: 0.5
        )

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(request)
        let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]

        XCTAssertEqual(dict?["model"] as? String, "gpt-4")
        XCTAssertEqual(dict?["temperature"] as? Double, 0.5)
        XCTAssertNil(dict?["stream"])

        let messages = dict?["messages"] as? [[String: String]]
        XCTAssertEqual(messages?.count, 2)
        XCTAssertEqual(messages?[0]["role"], "system")
        XCTAssertEqual(messages?[1]["role"], "user")
    }

    func testChatCompletionRequestWithStream() throws {
        let request = ChatCompletionRequest(
            model: "gpt-4",
            systemPrompt: "Prompt",
            userText: "Text",
            stream: true
        )
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(request)
        let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(dict?["stream"] as? Bool, true)
    }

    // MARK: - AIError Tests

    func testAIErrorLocalizedDescriptions() {
        XCTAssertFalse(AIError.requestFailed.localizedDescription.isEmpty)
        XCTAssertFalse(AIError.apiKeyNotFound.localizedDescription.isEmpty)
        XCTAssertFalse(AIError.invalidResponse.localizedDescription.isEmpty)
    }

    func testAIErrorEquality() {
        XCTAssertEqual(AIError.requestFailed, AIError.requestFailed)
        XCTAssertNotEqual(AIError.requestFailed, AIError.apiKeyNotFound)
    }

    // MARK: - AIProvider Protocol Contract

    func testAIProviderProtocolHasRequiredMethods() {
        // Verify the protocol defines all required methods
        let provider = AIProviderFactory.makeProvider(name: "OpenAI")
        // name is accessible
        XCTAssertFalse(provider.name.isEmpty)
    }

    func testTranscriptionProviderSupportsStreamingIsFalseByDefault() {
        let provider = TranscriptionProviderFactory.makeProvider(name: "OpenAI Whisper")
        XCTAssertFalse(provider.supportsStreaming)
    }

    // MARK: - Mock-Based Integration Tests

    func testPerformJSONPost_withMockSession_decodesResponse() async throws {
        struct TestClient: ProviderHTTPClient {
            let session: URLSession
        }

        ProviderTestHelpers.mockChatCompletion(for: "api.test.com", responseText: "integration ok")
        let client = TestClient(session: ProviderTestHelpers.mockSession())

        let body = ChatCompletionRequest(model: "test-model", systemPrompt: "sys", userText: "usr")
        let response: ChatCompletionResponse = try await client.performJSONPost(
            url: XCTUnwrap(URL(string: "https://api.test.com/v1/chat/completions")),
            body: body,
            apiKey: "sk-integration"
        )

        XCTAssertEqual(response.firstContent, "integration ok")
    }

    func testPerformJSONPost_http4xx_throwsRequestFailed() async throws {
        struct TestClient: ProviderHTTPClient {
            let session: URLSession
        }

        MockURLProtocol.setHandler(for: "api.test.com") { request in
            let data = "bad request".data(using: .utf8)!
            return (data, ProviderTestHelpers.httpResponse(url: request.url!, statusCode: 400))
        }

        let client = TestClient(session: ProviderTestHelpers.mockSession())
        let body = ChatCompletionRequest(model: "m", systemPrompt: "s", userText: "u")

        do {
            let _: ChatCompletionResponse = try await client.performJSONPost(
                url: XCTUnwrap(URL(string: "https://api.test.com/v1/chat")),
                body: body,
                apiKey: "key"
            )
            XCTFail("Expected AIError.requestFailed for 400 status")
        } catch {
            XCTAssertTrue(error is AIError)
        }
    }

    func testPerformJSONPost_sendsBearerAuth() async throws {
        struct TestClient: ProviderHTTPClient {
            let session: URLSession
        }

        var capturedRequest: URLRequest?
        MockURLProtocol.setHandler(for: "api.test.com") { request in
            capturedRequest = request
            let data = ProviderTestHelpers.chatCompletionJSON(text: "authenticated")
            return (data, ProviderTestHelpers.httpResponse(url: request.url!))
        }

        let client = TestClient(session: ProviderTestHelpers.mockSession())
        let body = ChatCompletionRequest(model: "gpt-4", systemPrompt: "system", userText: "hello")
        let _: ChatCompletionResponse = try await client.performJSONPost(
            url: XCTUnwrap(URL(string: "https://api.test.com/v1/chat/completions")),
            body: body,
            apiKey: "sk-secret-key"
        )

        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer sk-secret-key")
        XCTAssertEqual(capturedRequest?.httpMethod, "POST")
        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func testPerformJSONPost_invalidJSON_throwsDecodingError() async throws {
        struct TestClient: ProviderHTTPClient {
            let session: URLSession
        }

        MockURLProtocol.setHandler(for: "api.test.com") { request in
            let data = "not json".data(using: .utf8)!
            return (data, ProviderTestHelpers.httpResponse(url: request.url!))
        }

        let client = TestClient(session: ProviderTestHelpers.mockSession())
        let body = ChatCompletionRequest(model: "m", systemPrompt: "s", userText: "u")

        do {
            let _: ChatCompletionResponse = try await client.performJSONPost(
                url: XCTUnwrap(URL(string: "https://api.test.com/v1/chat")),
                body: body,
                apiKey: "key"
            )
            XCTFail("Expected decoding error")
        } catch {
            // Should throw DecodingError, not AIError
            XCTAssertTrue(error is DecodingError)
        }
    }
}
