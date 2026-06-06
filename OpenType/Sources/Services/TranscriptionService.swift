import Data
import Foundation
import Models
import Providers

public class TranscriptionService: @unchecked Sendable {
    public static let shared = TranscriptionService()

    private let chunkedService = ChunkedTranscriptionService()

    private init() {}

    public func transcribe(audioURL: URL, language: String? = nil) async throws -> TranscriptionResult {
        let provider = TranscriptionProviderFactory.makeProvider(
            name: SettingsStore.shared.selectedTranscriptionProvider
        )
        return try await provider.transcribe(audioURL: audioURL, language: language)
    }

    public func transcribeStreaming(audioURL: URL, language: String? = nil) -> AsyncThrowingStream<String, Error> {
        let provider = TranscriptionProviderFactory.makeProvider(
            name: SettingsStore.shared.selectedTranscriptionProvider
        )
        if provider.supportsChunkedStreaming {
            return chunkedService.transcribeChunked(
                audioURL: audioURL,
                provider: provider,
                language: language
            )
        }
        return provider.transcribeStreaming(audioURL: audioURL, language: language)
    }

    public func getAvailableProviders() -> [any TranscriptionProvider] {
        return TranscriptionProviderFactory.getAvailableProviders()
    }
}
