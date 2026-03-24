import Foundation
import Models
import Providers
import Data

public class TranscriptionService: @unchecked Sendable {
    public static let shared = TranscriptionService()

    private init() {}

    public func transcribe(audioURL: URL, language: String? = nil) async throws -> TranscriptionResult {
        let provider = TranscriptionProviderFactory.makeProvider(
            name: SettingsStore.shared.selectedTranscriptionProvider
        )
        return try await provider.transcribe(audioURL: audioURL, language: language)
    }

    public func getAvailableProviders() -> [TranscriptionProvider] {
        return [AppleSpeechProvider()]
    }
}
