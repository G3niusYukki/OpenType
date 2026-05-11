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

    public func replaceSelectedText(with newText: String) {
        guard PermissionService.shared.checkAccessibilityPermission() else {
            insertViaClipboard(newText)
            return
        }

        let systemWideElement = AXUIElementCreateSystemWide()
        var focusedElement: CFTypeRef?
        AXUIElementCopyAttributeValue(systemWideElement, kAXFocusedUIElementAttribute as CFString, &focusedElement)

        guard let element = focusedElement else {
            insertViaClipboard(newText)
            return
        }

        let axElement = element as! AXUIElement

        // Delete existing selection by backspacing first, then paste
        let source = CGEventSource(stateID: .hidSystemState)

        // Backspace to clear selection
        if let deleteDown = CGEvent(keyboardEventSource: source, virtualKey: 0x33, keyDown: true),
           let deleteUp = CGEvent(keyboardEventSource: source, virtualKey: 0x33, keyDown: false) {
            deleteDown.post(tap: .cgAnnotatedSessionEventTap)
            deleteUp.post(tap: .cgAnnotatedSessionEventTap)
        }

        // Insert the new text via clipboard paste
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(newText, forType: .string)

        if let cmdVDown = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: true),
           let cmdVUp = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: false) {
            cmdVDown.flags = .maskCommand
            cmdVUp.flags = .maskCommand
            cmdVDown.post(tap: .cgAnnotatedSessionEventTap)
            cmdVUp.post(tap: .cgAnnotatedSessionEventTap)
        }
    }

    public func insertTextAfterSelection(_ text: String) {
        guard PermissionService.shared.checkAccessibilityPermission() else {
            insertViaClipboard(text)
            return
        }

        // Move cursor to end of selection to deselect
        let source = CGEventSource(stateID: .hidSystemState)
        if let rightDown = CGEvent(keyboardEventSource: source, virtualKey: 0x7C, keyDown: true),
           let rightUp = CGEvent(keyboardEventSource: source, virtualKey: 0x7C, keyDown: false) {
            rightDown.post(tap: .cgAnnotatedSessionEventTap)
            rightUp.post(tap: .cgAnnotatedSessionEventTap)
        }

        // Small delay to ensure cursor moved
        usleep(50_000)

        // Now insert the text
        do {
            try insertText(text)
        } catch {
            insertViaClipboard(text)
        }
    }

    public func hasAccessibilityPermission() -> Bool {
        PermissionService.shared.checkAccessibilityPermission()
    }
}
