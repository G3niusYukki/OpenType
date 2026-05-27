import Foundation
import OpenTypeModels
import OpenTypeData

public protocol TranscriptionProvider: Sendable {
    var name: String { get }
    var supportsStreaming: Bool { get }

    func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult
    func transcribeStreaming(audioURL: URL, language: String?) -> AsyncThrowingStream<String, Error>
}

extension TranscriptionProvider {
    public var supportsStreaming: Bool { false }
    public func transcribeStreaming(audioURL: URL, language: String?) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let result = try await transcribe(audioURL: audioURL, language: language)
                    continuation.yield(result.text)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
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
        case "Tencent Cloud ASR":
            return TencentASRProvider()
        case "Baidu Cloud ASR":
            return BaiduASRProvider()
        case "iFlytek ASR":
            return IFlytekASRProvider()
        case "Whisper.cpp":
            return WhisperCPPProvider()
        default:
            return AppleSpeechProvider()
        }
    }

    public static func getAvailableProviders() -> [any TranscriptionProvider] {
        return [
            AppleSpeechProvider(),
            OpenAIWhisperProvider(),
            GroqTranscriptionProvider(),
            AliyunASRProvider(),
            TencentASRProvider(),
            BaiduASRProvider(),
            IFlytekASRProvider(),
            WhisperCPPProvider()
        ]
    }
}
