import AppKit
@testable import Models
@testable import OpenTypeUI
import XCTest

@MainActor
final class TextInsertionFocusGuardTests: XCTestCase {
    func test_frontmost_match_allows_insert() {
        XCTAssertEqual(InsertionFocusGuard.decide(captured: "com.example.app", current: "com.example.app"), .insert)
    }

    func test_frontmost_changed_falls_back() {
        XCTAssertEqual(InsertionFocusGuard.decide(captured: "com.example.app", current: "com.other.app"), .fallbackToClipboard)
    }

    func test_frontmost_nil_falls_back() {
        XCTAssertEqual(InsertionFocusGuard.decide(captured: "com.example.app", current: nil), .fallbackToClipboard)
    }

    func test_captured_nil_allows_insert() {
        XCTAssertEqual(InsertionFocusGuard.decide(captured: nil, current: "com.example.app"), .insert)
    }
}
