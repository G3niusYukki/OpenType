import AppKit
import Foundation

/// Coordinates text insertion strategies and streaming insertion.
/// Extracted from PopoverViewModel to separate insertion concerns from UI state.
public final class TextInsertionCoordinator {
    private let textInserter: TextInsertionService
    public let streamingInserter: StreamingTextInserter

    public init(
        textInserter: TextInsertionService = .shared,
        streamingInserter: StreamingTextInserter = StreamingTextInserter()
    ) {
        self.textInserter = textInserter
        self.streamingInserter = streamingInserter
    }

    /// Insert text using the best available method. Returns error message on failure, nil on success.
    public func insertText(_ text: String) -> String? {
        do {
            try textInserter.insertText(text)
            return nil
        } catch let error as TextInsertionError {
            switch error {
            case .noAccessibilityPermission:
                return "需要辅助功能权限才能插入文本，请在系统设置中授权"
            case .allMethodsFailed:
                return "文本已复制到剪贴板，请手动粘贴 (Cmd+V)"
            default:
                return "文本插入失败: \(error.localizedDescription)"
            }
        } catch {
            return "文本插入失败: \(error.localizedDescription)"
        }
    }

    /// Copy text to clipboard as fallback.
    public func copyToClipboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    /// Get selected text from the focused element.
    public func getSelectedText() -> String? {
        textInserter.getSelectedText()
    }

    /// Replace selected text.
    public func replaceSelectedText(with text: String) {
        textInserter.replaceSelectedText(with: text)
    }

    /// Insert text after selection.
    public func insertTextAfterSelection(_ text: String) {
        textInserter.insertTextAfterSelection(text)
    }

    /// Reset streaming inserter for a new session.
    public func resetStreaming() async {
        await streamingInserter.reset()
    }
}
