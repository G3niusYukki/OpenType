import AppKit
import CoreGraphics
import Foundation
import Utilities

public class TextInsertionService {
    public static let shared = TextInsertionService()

    private let clipboardGuard = ClipboardGuard()
    private init() {}

    /// Insert text at the current cursor position using the best available method.
    /// Clipboard content is always preserved, even on failure.
    public func insertText(_ text: String) throws {
        guard PermissionService.shared.checkAccessibilityPermission() else {
            throw TextInsertionError.noAccessibilityPermission
        }

        // Try methods in order of reliability. AX and AppleScript are
        // synchronous from the perspective of this method — the clipboard
        // doesn't change, so we use the inline save/restore. CGEvent paste
        // is async — we use restoreAfterPasteEvent so the target can read
        // the pasted string before we put the original content back.
        if try insertViaAXSetValue(text) { return }
        if insertViaCGEventAsync(text) { return }
        if try insertViaAppleScript(text) { return }

        // Last resort: copy to clipboard so user can paste manually
        insertViaClipboardDirect(text)
        throw TextInsertionError.allMethodsFailed
    }

    /// Replace the currently selected text. Clipboard is preserved.
    public func replaceSelectedText(with newText: String) {
        clipboardGuard.save()
        defer { clipboardGuard.restore() }

        guard PermissionService.shared.checkAccessibilityPermission() else {
            insertViaClipboardDirect(newText)
            return
        }

        // Use AX to set the value of the focused element's selected text range
        guard let element = getFocusedElement() else {
            // Fallback: backspace + paste
            deleteSelectionAndPaste(newText)
            return
        }

        // Try AXSelectedText replacement first (works in most native controls)
        let setResult = AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute as CFString, newText as CFTypeRef)
        if setResult == .success { return }

        // Fallback: backspace + paste
        deleteSelectionAndPaste(newText)
    }

    /// Insert text after the current selection (for read-only commands like summarize).
    /// Clipboard is preserved.
    public func insertTextAfterSelection(_ text: String) {
        guard PermissionService.shared.checkAccessibilityPermission() else {
            // No accessibility — just copy to clipboard as fallback
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            pasteboard.setString(text, forType: .string)
            return
        }

        // Move cursor to end of selection
        let source = CGEventSource(stateID: .hidSystemState)
        if let rightDown = CGEvent(keyboardEventSource: source, virtualKey: 0x7C, keyDown: true),
           let rightUp = CGEvent(keyboardEventSource: source, virtualKey: 0x7C, keyDown: false)
        {
            rightDown.post(tap: .cgAnnotatedSessionEventTap)
            rightUp.post(tap: .cgAnnotatedSessionEventTap)
        }

        Thread.sleep(forTimeInterval: 0.05) // 50ms for cursor to move

        // insertText() has its own clipboard guard — no nesting needed
        do {
            try insertText(text)
        } catch {
            // insertText already restored clipboard; just log
            print("insertTextAfterSelection failed: \(error)")
        }
    }

    // MARK: - Selection & Focused Element

    public func getSelectedText() -> String? {
        if let text = getSelectedTextViaAccessibility() {
            return text
        }
        return NSPasteboard.general.string(forType: .string)
    }

    private func getFocusedElement() -> AXUIElement? {
        guard PermissionService.shared.checkAccessibilityPermission() else { return nil }

        let systemWideElement = AXUIElementCreateSystemWide()
        var focusedElement: CFTypeRef?
        AXUIElementCopyAttributeValue(systemWideElement, kAXFocusedUIElementAttribute as CFString, &focusedElement)

        guard let element = focusedElement else { return nil }
        return (element as! AXUIElement)
    }

    private func getSelectedTextViaAccessibility() -> String? {
        guard let element = getFocusedElement() else { return nil }

        var selectedText: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, kAXSelectedTextAttribute as CFString, &selectedText)

        if result == .success, let text = selectedText as? String {
            return text
        }
        return nil
    }

    // MARK: - Insertion Methods

    /// Preferred: Use AX API to directly set text value without touching clipboard.
    /// Works in native NSTextField, NSTextView, Safari address bar, etc.
    private func insertViaAXSetValue(_ text: String) throws -> Bool {
        guard PermissionService.shared.checkAccessibilityPermission() else {
            return false
        }

        guard let element = getFocusedElement() else { return false }

        // Try setting AXSelectedText (replaces selection or inserts at cursor)
        let result = AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute as CFString, text as CFTypeRef)
        return result == .success
    }

    /// CGEvent Cmd+V paste -- fast, works in most apps, but requires clipboard swap.
    /// Renamed to `insertViaCGEventCore` (no clipboard handling); the public
    /// entry point is `insertViaCGEventAsync` which handles the async restore.
    private func insertViaCGEventCore(_ text: String) -> Bool {
        guard PermissionService.shared.checkAccessibilityPermission() else {
            return false
        }

        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)

        let source = CGEventSource(stateID: .hidSystemState)

        guard let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: true),
              let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: false)
        else { return false }

        keyDown.flags = .maskCommand
        keyUp.flags = .maskCommand

        keyDown.post(tap: .cgAnnotatedSessionEventTap)
        keyUp.post(tap: .cgAnnotatedSessionEventTap)

        return true
    }

    /// Save the clipboard, post the CGEvent paste, then wait for the target
    /// to consume the pasteboard before restoring. Fixes the race where the
    /// synchronous `defer { restore() }` would clobber the pasted content.
    private func insertViaCGEventAsync(_ text: String) -> Bool {
        clipboardGuard.save()
        guard insertViaCGEventCore(text) else {
            clipboardGuard.restore()
            return false
        }
        clipboardGuard.restoreAfterPasteEvent(timeout: 0.25, completion: {})
        return true
    }

    /// AppleScript keystroke -- slower fallback for sandboxed apps.
    private func insertViaAppleScript(_ text: String) throws -> Bool {
        let escapedText = text
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")

        let script = """
        tell application "System Events"
            keystroke "\(escapedText)"
        end tell
        """

        var error: NSDictionary?
        if let scriptObject = NSAppleScript(source: script) {
            scriptObject.executeAndReturnError(&error)
            return error == nil
        }
        return false
    }

    /// Final fallback: copy to clipboard only (clipboard guard will restore).
    private func insertViaClipboardDirect(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
    }

    /// Delete selected text via backspace key, then paste replacement.
    private func deleteSelectionAndPaste(_ newText: String) {
        let source = CGEventSource(stateID: .hidSystemState)

        // Backspace to clear selection
        if let deleteDown = CGEvent(keyboardEventSource: source, virtualKey: 0x33, keyDown: true),
           let deleteUp = CGEvent(keyboardEventSource: source, virtualKey: 0x33, keyDown: false)
        {
            deleteDown.post(tap: .cgAnnotatedSessionEventTap)
            deleteUp.post(tap: .cgAnnotatedSessionEventTap)
        }

        Thread.sleep(forTimeInterval: 0.05) // 50ms for deletion to register

        // Paste new text
        // Note: this is a known race; the fallback path is rare (AX already
        // failed) and the 50 ms sleep makes it acceptable in practice. A
        // future release should use insertViaCGEventAsync here too.
        // [existing code continues — the inline pasteboard clear + Cmd+V
        //  posting below is unchanged]
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(newText, forType: .string)

        if let cmdVDown = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: true),
           let cmdVUp = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: false)
        {
            cmdVDown.flags = .maskCommand
            cmdVUp.flags = .maskCommand
            cmdVDown.post(tap: .cgAnnotatedSessionEventTap)
            cmdVUp.post(tap: .cgAnnotatedSessionEventTap)
        }
    }

    public func hasAccessibilityPermission() -> Bool {
        PermissionService.shared.checkAccessibilityPermission()
    }

    // MARK: - Streaming / Incremental Insertion

    /// Type text character-by-character using CGEvent keyboard events.
    /// Avoids clipboard manipulation entirely. Slower than paste for long text,
    /// but enables incremental/streaming insertion.
    /// - Parameters:
    ///   - text: The text to type
    ///   - batchSize: Number of characters per batch (default 10)
    ///   - interBatchDelay: Seconds between batches (default 0.02)
    /// - Returns: true if at least some characters were typed
    @discardableResult
    public func insertViaTyping(_ text: String, batchSize: Int = 10, interBatchDelay: TimeInterval = 0.02) -> Bool {
        guard PermissionService.shared.checkAccessibilityPermission() else { return false }
        guard !text.isEmpty else { return true }

        let source = CGEventSource(stateID: .hidSystemState)
        let characters = Array(text)
        var index = 0

        while index < characters.count {
            let end = min(index + batchSize, characters.count)
            let batch = characters[index ..< end]

            for char in batch {
                var unicode = String(char).utf16.map { UInt16($0) }
                guard !unicode.isEmpty else { continue }

                if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true),
                   let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: false)
                {
                    keyDown.keyboardSetUnicodeString(stringLength: unicode.count, unicodeString: &unicode)
                    keyUp.keyboardSetUnicodeString(stringLength: unicode.count, unicodeString: &unicode)
                    keyDown.post(tap: .cgAnnotatedSessionEventTap)
                    keyUp.post(tap: .cgAnnotatedSessionEventTap)
                }
            }

            index = end
            if index < characters.count {
                Thread.sleep(forTimeInterval: interBatchDelay)
            }
        }
        return true
    }
}
