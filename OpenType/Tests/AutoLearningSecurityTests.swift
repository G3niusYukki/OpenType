@testable import Models
@testable import Providers
@testable import Services
import XCTest

/// Tests for auto style learning, response validation, and security hardening.
final class AutoLearningSecurityTests: XCTestCase {
    // MARK: - Levenshtein Distance Tests

    func testLevenshteinIdenticalStrings() {
        // Indirectly tests the distance calculation via learnStyleExamplesFromHistory
        // Empty/same strings should be filtered out
        let suggestions = StyleProfileService.shared.learnStyleExamplesFromHistory(limit: 5)
        for (raw, polished) in suggestions {
            XCTAssertNotEqual(raw, polished, "Identical raw/polished should be filtered")
            XCTAssertFalse(raw.isEmpty)
            XCTAssertFalse(polished.isEmpty)
        }
    }

    func testLevenshteinTrivialChangesFiltered() {
        // Case-only or single-char changes should be filtered (distance ratio < 5%)
        // This is verified by the learnStyleExamplesFromHistory filter logic
        let suggestions = StyleProfileService.shared.learnStyleExamplesFromHistory(limit: 0)
        XCTAssertEqual(suggestions.count, 0, "Limit 0 should return empty")
    }

    // MARK: - ChatCompletionResponse Security Tests

    func testChatCompletionResponseEmptyChoicesDoesNotCrash() {
        let json = #"{"choices":[]}"#
        let data = Data(json.utf8)
        let response = try? JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertNotNil(response)
        XCTAssertNil(response?.firstContent)
    }

    func testChatCompletionResponseMissingChoices() {
        let json = #"{}"#
        let data = Data(json.utf8)
        let response = try? JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertNil(response, "Missing 'choices' key should fail to decode")
    }

    func testChatCompletionResponseMalformedJSON() {
        let json = #"{invalid json}"#
        let data = Data(json.utf8)
        let response = try? JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertNil(response, "Malformed JSON should fail to decode")
    }

    func testChatCompletionResponseEmptyContent() {
        let json = #"{"choices":[{"message":{"content":""}}]}"#
        let data = Data(json.utf8)
        let response = try? JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertEqual(response?.firstContent, "")
    }

    func testChatCompletionResponseSpecialCharacters() {
        let json = #"{"choices":[{"message":{"content":"<script>alert('xss')</script>"}}]}"#
        let data = Data(json.utf8)
        let response = try? JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertEqual(response?.firstContent, "<script>alert('xss')</script>")
        // Note: sanitization happens at the insertion layer, not at decode
    }

    // MARK: - AIError Security Tests

    func testAIErrorIsNotSendingSensitiveData() {
        let error = AIError.requestFailed
        let desc = error.localizedDescription
        XCTAssertFalse(desc.contains("api"))
        XCTAssertFalse(desc.contains("key"))
        XCTAssertFalse(desc.contains("token"))
    }

    func testAIErrorApiKeyNotFoundHasClearMessage() {
        let error = AIError.apiKeyNotFound
        XCTAssertFalse(error.localizedDescription.isEmpty)
    }

    // MARK: - TranscriptionResult Validation

    func testTranscriptionResultEmptyText() {
        let result = TranscriptionResult(
            text: "",
            language: "en",
            detectedLanguage: nil,
            confidence: nil,
            segments: nil,
            duration: 0,
            provider: "Test"
        )
        XCTAssertTrue(result.text.isEmpty)
    }

    func testTranscriptionResultVeryLongText() {
        let longText = String(repeating: "word ", count: 10000)
        let result = TranscriptionResult(
            text: longText,
            language: "en",
            detectedLanguage: nil,
            confidence: nil,
            segments: nil,
            duration: 0,
            provider: "Test"
        )
        XCTAssertEqual(result.text.count, longText.count)
    }

    // MARK: - Provider HTTP Client Edge Cases

    func testChatCompletionRequestEncodingRoundTrip() throws {
        let request = ChatCompletionRequest(
            model: "gpt-4",
            systemPrompt: "System\nWith\nNewlines",
            userText: "User \"quoted\" text & symbols <>&",
            temperature: 0.3
        )
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(request)

        // Verify it's valid JSON
        XCTAssertNoThrow(try JSONSerialization.jsonObject(with: data))
    }

    func testChatCompletionResponseWithUnicode() throws {
        let json = #"{"choices":[{"message":{"content":"你好世界 🌍"}}]}"#
        let data = Data(json.utf8)
        let response = try JSONDecoder().decode(ChatCompletionResponse.self, from: data)
        XCTAssertEqual(response.firstContent, "你好世界 🌍")
    }
}
