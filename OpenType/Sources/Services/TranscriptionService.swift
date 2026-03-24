import Foundation
import Models
import Providers
import Data

public class TranscriptionService: @unchecked Sendable {
    public static let shared = TranscriptionService()

    private init() {}

    public func transcribe(audioURL: URL, language: String? = nil) async throws -> TranscriptionResult {
        let provider = makeProvider(for: SettingsStore.shared.selectedTranscriptionProvider)
        return try await provider.transcribe(audioURL: audioURL, language: language)
    }

    public func getAvailableProviders() -> [TranscriptionProvider] {
        return [AppleSpeechProvider()]
    }

    private func makeProvider(for name: String) -> any TranscriptionProvider {
        switch name {
        case "OpenAI Whisper":
            return OpenAIWhisperProvider()
        case "Groq":
            return GroqTranscriptionProvider()
        default:
            return AppleSpeechProvider()
        }
    }
}
