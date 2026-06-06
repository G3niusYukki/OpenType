@testable import Data
@testable import Models
@testable import Services
import XCTest

final class DictionaryServiceTests: XCTestCase {
    func testEmptyDictionaryReturnsOriginalText() {
        let input = "你好世界"
        let result = DictionaryService.shared.applyReplacements(to: input)
        XCTAssertEqual(result, input)
    }

    func testEmptyTextReturnsEmpty() {
        let result = DictionaryService.shared.applyReplacements(to: "")
        XCTAssertEqual(result, "")
    }
}
