import Foundation
import Models

public protocol TranscriptionProvider: Sendable {
    var name: String { get }
    var supportsStreaming: Bool { get }

    func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult
}

extension TranscriptionProvider {
    public var supportsStreaming: Bool { false }
}
