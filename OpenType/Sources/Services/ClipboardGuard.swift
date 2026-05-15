import AppKit

public final class ClipboardGuard: @unchecked Sendable {
    private let pasteboard = NSPasteboard.general
    private var savedContent: String?
    private var savedChangeCount: Int = 0

    public init() {}

    /// Capture current pasteboard state. Call before any insertion that may overwrite clipboard.
    public func save() {
        savedChangeCount = pasteboard.changeCount
        savedContent = pasteboard.string(forType: .string)
    }

    /// Restore pasteboard to the state captured by save().
    /// Skips restore if the user independently changed the clipboard between save/restore
    /// (detected via changeCount changing by more than what our own paste would cause),
    /// to avoid clobbering their action.
    public func restore() {
        // Our own CGEvent paste increments changeCount by 1.
        // If it changed by more, the user did something — don't overwrite.
        let delta = pasteboard.changeCount - savedChangeCount
        guard delta >= 0 && delta <= 2 else { return }

        if let content = savedContent {
            pasteboard.clearContents()
            pasteboard.setString(content, forType: .string)
        } else {
            // Clipboard was empty before — clear whatever we put there
            pasteboard.clearContents()
        }
    }
}
