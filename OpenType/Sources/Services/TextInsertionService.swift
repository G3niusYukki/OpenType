import Foundation
import AppKit
import CoreGraphics
import Utilities

public class TextInsertionService {
    public static let shared = TextInsertionService()

    private init() {}

    public func insertText(_ text: String) throws {
        if try insertViaCGEvent(text) { return }
        if try insertViaAppleScript(text) { return }
        insertViaClipboard(text)
    }

    private func insertViaCGEvent(_ text: String) throws -> Bool {
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

    private func insertViaClipboard(_ text: String) {
        print("Text copied to clipboard: \(text.prefix(50))...")
    }

    public func getSelectedText() -> String? {
        if let text = getSelectedTextViaAccessibility() {
            return text
        }
        return NSPasteboard.general.string(forType: .string)
    }

    private func getSelectedTextViaAccessibility() -> String? {
        guard PermissionService.shared.checkAccessibilityPermission() else { return nil }

        let systemWideElement = AXUIElementCreateSystemWide()
        var focusedElement: CFTypeRef?
        AXUIElementCopyAttributeValue(systemWideElement, kAXFocusedUIElementAttribute as CFString, &focusedElement)

        guard let element = focusedElement else { return nil }

        var selectedText: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element as! AXUIElement, kAXSelectedTextAttribute as CFString, &selectedText)

        if result == .success, let text = selectedText as? String {
            return text
        }
        return nil
    }

    public func hasAccessibilityPermission() -> Bool {
        PermissionService.shared.checkAccessibilityPermission()
    }
}
