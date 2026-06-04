import Foundation
import AppKit

/// Decides whether it's safe to auto-insert transcribed text into the
/// currently-focused app, given the bundle ID captured at recording start.
public enum InsertionFocusGuard {
    case insert
    case fallbackToClipboard

    /// `captured` is the bundle ID observed when recording started.
    /// `current`  is the bundle ID observed when we're about to insert.
    public static func decide(captured: String?, current: String?) -> InsertionFocusGuard {
        guard let captured = captured else { return .insert }
        guard let current = current else { return .fallbackToClipboard }
        return captured == current ? .insert : .fallbackToClipboard
    }
}
