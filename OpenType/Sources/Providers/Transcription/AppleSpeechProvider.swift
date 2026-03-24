import Foundation
import Speech
import Models
import Utilities

public actor AppleSpeechProvider: TranscriptionProvider {
    public let name = "Apple Speech"
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
                let detectedLocale = result.bestTranscription.segments.first.map { _ in
                    self.recognizer.locale.identifier
                }

                let transcriptionResult = TranscriptionResult(
                    text: text,
                    language: language ?? detectedLocale,
                    confidence: nil,
                    segments: nil,
                    duration: 0,
                    provider: self.name
                )
                continuation.resume(returning: transcriptionResult)
            }
        }
    }
}
