@testable import Utilities
import XCTest

final class SSEParserTests: XCTestCase {
    func testParseSingleDataLine() {
        let input = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n"
        let events = SSEParser.parse(input)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.data, "{\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}")
    }

    func testParseMultipleDataLines() {
        let input = """
        data: {"choices":[{"delta":{"content":"Hello"}}]}

        data: {"choices":[{"delta":{"content":" world"}}]}

        data: [DONE]

        """
        let events = SSEParser.parse(input)
        XCTAssertEqual(events.count, 3)
        XCTAssertEqual(events[2].data, "[DONE]")
    }

    func testParseIgnoresEmptyLines() {
        let input = "\n\ndata: test\n\n\n\n"
        let events = SSEParser.parse(input)
        XCTAssertEqual(events.count, 1)
    }

    func testParseHandlesNoNewlineAtEnd() {
        let input = "data: hello"
        let events = SSEParser.parse(input)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.data, "hello")
    }

    func testParseHandlesMultilineData() {
        let input = "data: line1\ndata: line2\n\n"
        let events = SSEParser.parse(input)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.data, "line1\nline2")
    }
}
