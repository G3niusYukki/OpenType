import Foundation

public enum TextInsertionError: Error, LocalizedError {
    case noAccessibilityPermission
    case noFocusedElement
    case insertionFailed(method: String)
    case allMethodsFailed
    case clipboardOperationFailed

    public var errorDescription: String? {
        switch self {
        case .noAccessibilityPermission:
            return "Accessibility permission required for text insertion"
        case .noFocusedElement:
            return "No focused text input element found"
        case .insertionFailed(let method):
            return "Text insertion failed via \(method)"
        case .allMethodsFailed:
            return "All text insertion methods failed"
        case .clipboardOperationFailed:
            return "Clipboard operation failed"
        }
    }
}
