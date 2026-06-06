import AppKit
import Foundation

/// Consumes an AsyncThrowingStream of accumulated text and types the deltas
/// incrementally into the target application using CGEvent keystrokes.
///
/// Usage:
/// ```swift
/// let inserter = StreamingTextInserter(textInsertionService: textInserter)
/// await inserter.insertStreaming(aiService.processStreaming(text: text))
/// ```
public actor StreamingTextInserter {
    private let textInsertionService: TextInsertionService
    private let batchSize: Int
    private let interBatchDelay: TimeInterval
    private let focusCheckInterval: Int
    /// Injectable typing function — defaults to real CGEvent typing.
    /// Replace with a capture closure in tests to avoid posting system keystrokes.
    private let typeText: (String, Int, TimeInterval) -> Bool

    /// Tracks how many characters have been typed so far.
    private var typedCount = 0

    public init(
        textInsertionService: TextInsertionService = .shared,
        batchSize: Int = 10,
        interBatchDelay: TimeInterval = 0.02,
        focusCheckInterval: Int = 5,
        typeText: ((String, Int, TimeInterval) -> Bool)? = nil
    ) {
        self.textInsertionService = textInsertionService
        self.batchSize = batchSize
        self.interBatchDelay = interBatchDelay
        self.focusCheckInterval = focusCheckInterval
        self.typeText = typeText ?? { text, batch, delay in
            textInsertionService.insertViaTyping(text, batchSize: batch, interBatchDelay: delay)
        }
    }

    /// Consume a streaming AI response and type text incrementally.
    /// Returns the final accumulated text.
    @discardableResult
    public func insertStreaming(
        _ stream: AsyncThrowingStream<String, Error>,
        capturedBundleID: String? = nil
    ) async throws -> String {
        var lastAccumulated = ""
        var batchCount = 0

        for try await accumulated in stream {
            let delta = String(accumulated.dropFirst(typedCount))
            guard !delta.isEmpty else { continue }

            // Periodic focus check — if user switched apps, stop typing
            batchCount += 1
            if let captured = capturedBundleID,
               batchCount % focusCheckInterval == 0,
               let current = NSWorkspace.shared.frontmostApplication?.bundleIdentifier,
               current != captured
            {
                // Focus lost — copy remaining to clipboard as fallback
                let remaining = String(accumulated.dropFirst(typedCount))
                if !remaining.isEmpty {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(remaining, forType: .string)
                }
                typedCount = accumulated.count
                return accumulated
            }

            _ = typeText(delta, batchSize, interBatchDelay)
            typedCount = accumulated.count
            lastAccumulated = accumulated
        }

        return lastAccumulated
    }

    /// Reset state for a new insertion session.
    public func reset() {
        typedCount = 0
    }
}
