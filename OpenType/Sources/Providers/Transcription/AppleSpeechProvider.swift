import Foundation
import Speech
import Models
import Utilities

public class AppleSpeechProvider: TranscriptionProvider, @unchecked Sendable {
    public let name = "Apple Speech"
    public var supportsStreaming: Bool { true }
    private let recognizer: SFSpeechRecognizer

    public init(locale: Locale = .current) {
        self.recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer()!
    }

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        if PermissionService.shared.checkSpeechPermission() != .granted {
            let status = await PermissionService.shared.requestSpeechPermission()
            if status != .granted {
                throw TranscriptionError.speechPermissionDenied
            }
        }

        let request = SFSpeechURLRecognitionRequest(url: audioURL)
        request.shouldReportPartialResults = false
        request.addsPunctuation = true

        return try await withCheckedThrowingContinuation { continuation in
            recognizer.recognitionTask(with: request) { result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let result = result, result.isFinal else { return }

                let text = result.bestTranscription.formattedString
                let detected = self.recognizer.locale.identifier

                let transcriptionResult = TranscriptionResult(
                    text: text,
                    language: language ?? detected,
                    detectedLanguage: detected,
                    confidence: nil,
                    segments: nil,
                    duration: 0,
                    provider: self.name
                )
                continuation.resume(returning: transcriptionResult)
            }
        }
    }

    public func transcribeStreaming(audioURL: URL, language: String?) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                if PermissionService.shared.checkSpeechPermission() != .granted {
                    let status = await PermissionService.shared.requestSpeechPermission()
                    if status != .granted {
                        continuation.finish(throwing: TranscriptionError.speechPermissionDenied)
                        return
                    }
                }

                let request = SFSpeechURLRecognitionRequest(url: audioURL)
                request.shouldReportPartialResults = true
                request.addsPunctuation = true

                var lastText = ""
                recognizer.recognitionTask(with: request) { result, error in
                    if let error = error {
                        continuation.finish(throwing: error)
                        return
                    }

                    guard let result = result else { return }

                    let text = result.bestTranscription.formattedString
                    if text != lastText && !text.isEmpty {
                        continuation.yield(text)
                        lastText = text
                    }

                    if result.isFinal {
                        continuation.finish()
                    }
                }
            }
        }
    }
}
