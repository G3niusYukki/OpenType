@testable import Data
@testable import Models
import XCTest

final class HistoryStoreTests: XCTestCase {
    func testHistoryEntryProperties() {
        let entry = HistoryEntry(
            audioPath: "/tmp/test.wav",
            originalText: "hello",
            processedText: "hello world",
            mode: .basic,
            provider: "Apple Speech",
            duration: 5.0,
            language: "en"
        )

        XCTAssertEqual(entry.originalText, "hello")
        XCTAssertEqual(entry.processedText, "hello world")
        XCTAssertEqual(entry.mode, .basic)
        XCTAssertEqual(entry.provider, "Apple Speech")
        XCTAssertEqual(entry.duration, 5.0)
        XCTAssertEqual(entry.language, "en")
    }

    func testHistoryEntryUniqueIDs() {
        let entry1 = HistoryEntry(
            audioPath: "/tmp/1.wav",
            originalText: "a",
            processedText: "a",
            mode: .basic,
            provider: "test",
            duration: 1,
            language: "en"
        )
        let entry2 = HistoryEntry(
            audioPath: "/tmp/2.wav",
            originalText: "b",
            processedText: "b",
            mode: .basic,
            provider: "test",
            duration: 1,
            language: "en"
        )
        XCTAssertNotEqual(entry1.id, entry2.id)
    }

    func testHistoryEntryEncodable() throws {
        let entry = HistoryEntry(
            audioPath: "/tmp/test.wav",
            originalText: "hello",
            processedText: "hello",
            mode: .basic,
            provider: "Apple Speech",
            duration: 3.0,
            language: "en"
        )
        let data = try? JSONEncoder().encode(entry)
        XCTAssertNotNil(data)
        let decoded = try JSONDecoder().decode(HistoryEntry.self, from: XCTUnwrap(data))
        XCTAssertEqual(decoded.originalText, "hello")
    }

    func testDictionaryEntryModel() {
        let entry = Models.DictionaryEntry(
            id: "1",
            term: "hello",
            replacement: "world",
            category: "General"
        )
        XCTAssertEqual(entry.term, "hello")
        XCTAssertEqual(entry.replacement, "world")
        XCTAssertEqual(entry.category, "General")
    }
}
