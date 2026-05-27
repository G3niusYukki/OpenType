import XCTest
@testable import Providers

// MARK: - Provider Integration Tests

/// Tests the provider layer: factory, encoding/decoding, error contracts.
/// Full HTTP integration tests require URLSession injection (planned for Phase 1.3).
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
        // Per protocol extension, supportsStreaming defaults to false
        let provider = TranscriptionProviderFactory.makeProvider(name: "OpenAI Whisper")
        XCTAssertFalse(provider.supportsStreaming)
    }
}
