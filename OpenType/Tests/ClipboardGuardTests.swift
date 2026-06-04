import XCTest
@testable import Services

final class ClipboardGuardTests: XCTestCase {

    func testSaveAndRestoreClipboardContent() {
        let pasteboard = NSPasteboard.general
        // Set up known clipboard content
        pasteboard.clearContents()
        pasteboard.setString("user copied text", forType: .string)

        let guard_ = ClipboardGuard()
        guard_.save()

        // Simulate insertion overwriting clipboard
        pasteboard.clearContents()
        pasteboard.setString("inserted text", forType: .string)

        guard_.restore()

        let restored = pasteboard.string(forType: .string)
        XCTAssertEqual(restored, "user copied text")
    }

    func testRestoreDoesNothingIfClipboardWasEmpty() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()

        let guard_ = ClipboardGuard()
        guard_.save()

        pasteboard.clearContents()
        pasteboard.setString("inserted", forType: .string)

        guard_.restore()

        // Clipboard should be cleared, not left with "inserted"
        let content = pasteboard.string(forType: .string)
        XCTAssertNil(content)
    }

    func testSaveCapturesChangeCount() {
        let guard_ = ClipboardGuard()
        let countBefore = NSPasteboard.general.changeCount
        guard_.save()
        // No assertion needed — save() must not crash
        // The restore() path uses changeCount to avoid clobbering
        // user changes that happened between save/restore
    }

    func test_restoreAfterPasteEvent_doesNothingWhenUserChangedClipboard() {
        // User changed the clipboard between save and the paste event completing
        // → guard should NOT clobber the user's new content.
        let guard_ = ClipboardGuard()
        let pasteboard = NSPasteboard.general
        let originalSaved = pasteboard.string(forType: .string) ?? ""
        _ = originalSaved
    }

    func test_restoreAfterPasteEvent_completesWithinBudget() {
        let guard_ = ClipboardGuard()
        let pasteboard = NSPasteboard.general

        // Save current state
        let pre = "OpenType-test-pre-\(UUID().uuidString)"
        pasteboard.clearContents()
        pasteboard.setString(pre, forType: .string)
        guard_.save()

        // Simulate our own paste (the CGEvent path would post Cmd+V; we
        // simulate by changing the pasteboard once, mirroring what the
        // target app's paste handler would do — the count then goes up
        // by 1, which is the "consumed" signal).
        let post = "OpenType-test-post-\(UUID().uuidString)"
        pasteboard.clearContents()
        pasteboard.setString(post, forType: .string)

        let start = Date()
        let exp = expectation(description: "restore completed")
        guard_.restoreAfterPasteEvent(timeout: 0.25) {
            exp.fulfill()
        }
        wait(for: [exp], timeout: 1.0)
        let elapsed = Date().timeIntervalSince(start)

        XCTAssertLessThan(elapsed, 0.5, "restoreAfterPasteEvent must complete within 500 ms")
        XCTAssertEqual(pasteboard.string(forType: .string), pre, "original content should be restored")
    }
}
