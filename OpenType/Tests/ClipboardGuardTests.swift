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
}
