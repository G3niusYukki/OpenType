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
        guard delta >= 0, delta <= 2 else { return }

        if let content = savedContent {
            pasteboard.clearContents()
            pasteboard.setString(content, forType: .string)
        } else {
            // Clipboard was empty before — clear whatever we put there
            pasteboard.clearContents()
        }
    }

    /// Restore the pasteboard, but first wait for the target app to consume
    /// the Cmd+V paste. The CGEvent paste in `TextInsertionService` is async:
    /// if we restore synchronously, the target reads the user's old content
    /// or nothing at all. This method polls the pasteboard's `changeCount`
    /// (which the target increments by 1 when it reads) up to `timeout`
    /// seconds, then restores.
    public func restoreAfterPasteEvent(timeout: TimeInterval, completion: @escaping () -> Void) {
        let startCount = pasteboard.changeCount
        let deadline = Date().addingTimeInterval(timeout)
        let pollInterval: TimeInterval = 0.05

        func poll() {
            // Our own write incremented changeCount by 1; the target's paste
            // handler increments it by another 1. So we expect delta == 2
            // when the paste has been consumed.
            let delta = pasteboard.changeCount - startCount
            if delta >= 2 {
                restore()
                completion()
                return
            }
            if Date() >= deadline {
                // Give up: restore anyway, better a stale clipboard than
                // pasted-into-the-wrong-app.
                restore()
                completion()
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + pollInterval, execute: poll)
        }
        poll()
    }
}
