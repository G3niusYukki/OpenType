import XCTest
@testable import Services

final class TextInsertionErrorTests: XCTestCase {

    func testErrorDescriptions() {
        let noAccessibility = TextInsertionError.noAccessibilityPermission
        XCTAssertTrue(noAccessibility.localizedDescription.contains("Accessibility"))

        let noFocusedElement = TextInsertionError.noFocusedElement
        XCTAssertTrue(noFocusedElement.localizedDescription.contains("focused"))

        let insertionFailed = TextInsertionError.insertionFailed(method: "CGEvent")
        XCTAssertTrue(insertionFailed.localizedDescription.contains("CGEvent"))
    }

    func testAllMethodsFailed() {
        let error = TextInsertionError.allMethodsFailed
        XCTAssertTrue(error.localizedDescription.contains("All"))
    }
}
