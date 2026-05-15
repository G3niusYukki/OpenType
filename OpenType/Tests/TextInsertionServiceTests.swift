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

final class TextInsertionServiceTests: XCTestCase {

    func testInsertTextThrowsWhenNoAccessibility() {
        // In CI / test environment, accessibility is typically not granted.
        // insertText should throw noAccessibilityPermission rather than silently failing.
        let service = TextInsertionService.shared
        if !service.hasAccessibilityPermission() {
            XCTAssertThrowsError(try service.insertText("test")) { error in
                XCTAssertTrue(error is TextInsertionError)
                if case TextInsertionError.noAccessibilityPermission = error {
                    // Expected
                } else {
                    XCTFail("Expected noAccessibilityPermission, got \(error)")
                }
            }
        }
    }

    func testClipboardGuardPreservesContent() {
        // Verify the guard/restore cycle works independent of TextInsertionService
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString("user content", forType: .string)

        let guard_ = ClipboardGuard()
        guard_.save()

        // Simulate what CGEvent paste does: overwrite clipboard
        pasteboard.clearContents()
        pasteboard.setString("inserted text", forType: .string)

        guard_.restore()

        XCTAssertEqual(pasteboard.string(forType: .string), "user content")
    }
}
