@testable import Services
import XCTest

final class ChunkedTranscriptionTests: XCTestCase {
    private var service: ChunkedTranscriptionService!

    override func setUp() {
        super.setUp()
        service = ChunkedTranscriptionService()
    }

    // MARK: - deduplicateOverlap

    func testDeduplicateOverlap_emptyExisting_returnsFullNew() {
        let result = service.deduplicateOverlap(existing: "", new: "hello world")
        XCTAssertEqual(result, "hello world")
    }

    func testDeduplicateOverlap_noOverlap_returnsFullNew() {
        let result = service.deduplicateOverlap(
            existing: "the quick brown",
            new: "fox jumps over"
        )
        XCTAssertEqual(result, "fox jumps over")
    }

    func testDeduplicateOverlap_fullOverlap_returnsEmpty() {
        let result = service.deduplicateOverlap(
            existing: "hello world",
            new: "hello world"
        )
        XCTAssertEqual(result, "")
    }

    func testDeduplicateOverlap_partialOverlap_removesPrefix() {
        let result = service.deduplicateOverlap(
            existing: "the quick brown fox",
            new: "brown fox jumps over the lazy dog"
        )
        XCTAssertEqual(result, "jumps over the lazy dog")
    }

    func testDeduplicateOverlap_singleWordOverlap() {
        let result = service.deduplicateOverlap(
            existing: "this is a test",
            new: "test of the system"
        )
        XCTAssertEqual(result, "of the system")
    }

    func testDeduplicateOverlap_multipleWordOverlap() {
        let result = service.deduplicateOverlap(
            existing: "one two three four five",
            new: "three four five six seven"
        )
        XCTAssertEqual(result, "six seven")
    }

    func testDeduplicateOverlap_emptyNew_returnsEmpty() {
        let result = service.deduplicateOverlap(
            existing: "some text",
            new: ""
        )
        XCTAssertEqual(result, "")
    }

    func testDeduplicateOverlap_bothEmpty_returnsEmpty() {
        let result = service.deduplicateOverlap(existing: "", new: "")
        XCTAssertEqual(result, "")
    }

    func testDeduplicateOverlap_noCommonWords_returnsFullNew() {
        let result = service.deduplicateOverlap(
            existing: "alpha beta gamma",
            new: "delta epsilon zeta"
        )
        XCTAssertEqual(result, "delta epsilon zeta")
    }
}
