import Foundation
import Models
import Providers

public class TranscriptionService: @unchecked Sendable {
    public static let shared = TranscriptionService()

    private init() {}

    public func transcribe(audioURL: URL, language: String? = nil) async throws -> TranscriptionResult {
        // Default to Apple Speech for now (cloud providers added in Task 14)
        let provider = AppleSpeechProvider()
        return try await provider.transcribe(audioURL: audioURL, language: language)
    }

    public func getAvailableProviders() -> [TranscriptionProvider] {
        return [AppleSpeechProvider()]
    }
}
