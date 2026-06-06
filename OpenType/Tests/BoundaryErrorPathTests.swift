@testable import Data
@testable import Models
@testable import Providers
import XCTest

/// Tests for boundary conditions, error paths, and edge cases
/// across the data model and provider layers.
final class BoundaryErrorPathTests: XCTestCase {
    // MARK: - HistoryEntry Edge Cases

    func testHistoryEntryWithEmptyText() {
        let entry = HistoryEntry(
            audioPath: "/tmp/test.wav",
            originalText: "",
            processedText: "",
            mode: .basic,
            provider: "Apple Speech",
            duration: 0,
            language: "en"
        )
        XCTAssertEqual(entry.originalText, "")
        XCTAssertEqual(entry.processedText, "")
    }

    func testHistoryEntryWithVeryLongText() {
        let longText = String(repeating: "hello world ", count: 1000)
        let entry = HistoryEntry(
            audioPath: "/tmp/test.wav",
            originalText: longText,
            processedText: longText,
            mode: .basic,
            provider: "Apple Speech",
            duration: 60.0,
            language: "en"
        )
        XCTAssertEqual(entry.originalText, longText)
        XCTAssertEqual(entry.duration, 60.0)
    }

    // MARK: - VoiceMode Edge Cases

    func testVoiceModeAllCasesAreFive() {
        XCTAssertEqual(VoiceMode.allCases.count, 5)
    }

    func testVoiceModeRawValueRoundTrip() {
        for mode in VoiceMode.allCases {
            let raw = mode.rawValue
            let restored = VoiceMode(rawValue: raw)
            XCTAssertEqual(restored, mode, "Failed round-trip for \(raw)")
        }
    }

    // MARK: - TranscriptionResult Edge Cases

    func testTranscriptionResultNilConfidence() {
        let result = TranscriptionResult(
            text: "hello",
            language: "en",
            detectedLanguage: nil,
            confidence: nil,
            segments: nil,
            duration: 1.5,
            provider: "Test"
        )
        XCTAssertNil(result.confidence)
        XCTAssertNil(result.segments)
    }

    func testTranscriptionResultDetectedLanguageFallback() {
        let result = TranscriptionResult(
            text: "你好",
            language: nil,
            detectedLanguage: "zh",
            confidence: nil,
            segments: nil,
            duration: 2.0,
            provider: "OpenAI Whisper"
        )
        XCTAssertNil(result.language)
        XCTAssertEqual(result.detectedLanguage, "zh")
    }

    // MARK: - PromptPreset Edge Cases

    func testPromptPresetBuiltInsHaveDeterministicIDs() {
        // IDs must not change — they're used as stable references
        let ids = PromptPreset.builtIns.map(\.id)
        let expectedFirst = UUID(uuidString: "00000000-0000-0000-0000-000000000001")
        XCTAssertEqual(ids.first, expectedFirst)
    }

    func testPromptPresetBuiltInsNotEmpty() {
        XCTAssertEqual(PromptPreset.builtIns.count, 10)
    }

    // MARK: - DictionaryEntry Edge Cases

    func testDictionaryEntryEmptyTerm() {
        let entry = DictionaryEntry(id: "1", term: "", replacement: "fixed", category: "Test")
        XCTAssertTrue(entry.term.isEmpty)
        XCTAssertEqual(entry.replacement, "fixed")
    }

    // MARK: - TranscriptionProvider Protocol Defaults

    func testMultipleProvidersHaveExpectedNames() {
        let names = TranscriptionProviderFactory.getAvailableProviders().map(\.name)
        XCTAssertTrue(names.contains("Apple Speech"))
        XCTAssertTrue(names.contains("OpenAI Whisper"))
        XCTAssertTrue(names.contains("Groq"))
    }

    func testAppleSpeechProviderIsDefault() {
        let provider = TranscriptionProviderFactory.makeProvider(name: "")
        XCTAssertEqual(provider.name, "Apple Speech")
    }

    // MARK: - AIProvider Factory Edge Cases

    func testFactoryReturnsSameTypeForKnownName() {
        let a = AIProviderFactory.makeProvider(name: "OpenAI")
        let b = AIProviderFactory.makeProvider(name: "OpenAI")
        XCTAssertEqual(a.name, b.name)
    }

    func testAvailableProviderNamesAreUnique() {
        let available = AIProviderFactory.getAvailableProviders()
        let names = available.map(\.name)
        XCTAssertEqual(names.count, Set(names).count, "Provider names must be unique")
        XCTAssertGreaterThanOrEqual(available.count, 7)
    }

    // MARK: - ChatCompletionRequest Edge Cases

    func testChatCompletionRequestWithMinimalFields() throws {
        let request = ChatCompletionRequest(
            model: "",
            systemPrompt: "",
            userText: "",
            temperature: 0.0
        )
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let data = try encoder.encode(request)
        let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(dict?["temperature"] as? Double, 0.0)
    }
}
