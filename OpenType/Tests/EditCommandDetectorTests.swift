@testable import Models
@testable import Utilities
import XCTest

final class EditCommandDetectorTests: XCTestCase {
    func testDetectRephrase() {
        XCTAssertEqual(EditCommandDetector.detect(from: "rephrase this"), .rephrase)
        XCTAssertEqual(EditCommandDetector.detect(from: "rewrite it"), .rephrase)
    }

    func testDetectShorten() {
        XCTAssertEqual(EditCommandDetector.detect(from: "shorten this"), .shorten)
        XCTAssertEqual(EditCommandDetector.detect(from: "condense"), .shorten)
    }

    func testDetectLengthen() {
        XCTAssertEqual(EditCommandDetector.detect(from: "lengthen"), .lengthen)
        XCTAssertEqual(EditCommandDetector.detect(from: "elaborate"), .lengthen)
    }

    func testDetectSummarize() {
        XCTAssertEqual(EditCommandDetector.detect(from: "summarize"), .summarize)
    }

    func testDetectExplain() {
        XCTAssertEqual(EditCommandDetector.detect(from: "explain this"), .explain)
    }

    func testDetectTranslate() {
        if case let .translate(lang) = EditCommandDetector.detect(from: "translate to Chinese") {
            XCTAssertEqual(lang, "Chinese")
        } else {
            XCTFail("Expected translate command")
        }
    }

    func testDetectFixGrammar() {
        XCTAssertEqual(EditCommandDetector.detect(from: "fix grammar"), .fixGrammar)
    }

    func testDetectCustom() {
        XCTAssertEqual(EditCommandDetector.detect(from: "make it sound like Shakespeare"), .custom)
    }

    func testSummarizeIsReadOnly() {
        XCTAssertTrue(EditCommandDetector.detect(from: "summarize").isReadOnly)
    }

    func testRephraseIsNotReadOnly() {
        XCTAssertFalse(EditCommandDetector.detect(from: "rephrase").isReadOnly)
    }
}
