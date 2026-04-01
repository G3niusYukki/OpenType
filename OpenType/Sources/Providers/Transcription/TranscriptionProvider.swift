import Foundation
import Models
import Data

public protocol TranscriptionProvider: Sendable {
    var name: String { get }
    var supportsStreaming: Bool { get }

    func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult
}

extension TranscriptionProvider {
    public var supportsStreaming: Bool { false }
}

public enum TranscriptionProviderFactory {
    public static func makeProvider(name: String) -> any TranscriptionProvider {
        switch name {
        case "OpenAI Whisper":
            return OpenAIWhisperProvider()
        case "Groq":
            return GroqTranscriptionProvider()
        case "Alibaba Cloud ASR":
            return AliyunASRProvider()
        default:
            return AppleSpeechProvider()
        }
    }

    public static func getAvailableProviders() -> [any TranscriptionProvider] {
        return [
            AppleSpeechProvider(),
            OpenAIWhisperProvider(),
            GroqTranscriptionProvider(),
            AliyunASRProvider()
        ]
    }
}
