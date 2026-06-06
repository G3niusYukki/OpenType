import Data
import Foundation
import Models
import Speech
import Utilities

public class AppleSpeechProvider: TranscriptionProvider, @unchecked Sendable {
    public let name = "Apple Speech"
    public var supportsStreaming: Bool {
        true
    }

    private let recognizer: SFSpeechRecognizer

    public init(locale: Locale = .current) {
        recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer()!
    }

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        if PermissionService.shared.checkSpeechPermission() != .granted {
            let status = await PermissionService.shared.requestSpeechPermission()
            if status != .granted {
                throw TranscriptionError.speechPermissionDenied
            }
        }

        // Auto-detect mode: use parallel locale detection
        if language == nil {
            let recentLocales = SettingsStore.shared.recentLocales.prefix(3).map { Locale(identifier: $0) }
            let locales = recentLocales.isEmpty ? [Locale.current] : recentLocales

            let detector = AppleSpeechAutoDetector(locales: locales)
            let (text, locale, confidence) = try await detector.detect(audioURL: audioURL)

            let detectedIdentifier = locale.identifier

            // Update recentLocales: add detected locale to front, keep max 5 unique
            var updated = SettingsStore.shared.recentLocales
            updated.removeAll { $0 == detectedIdentifier }
            updated.insert(detectedIdentifier, at: 0)
            SettingsStore.shared.recentLocales = Array(updated.prefix(5))

            return TranscriptionResult(
                text: text,
                language: detectedIdentifier,
                detectedLanguage: detectedIdentifier,
                confidence: confidence,
                segments: nil,
                duration: 0,
                provider: name
            )
        }

        // Specific language mode: use the configured locale
        let request = SFSpeechURLRecognitionRequest(url: audioURL)
        request.shouldReportPartialResults = false
        request.addsPunctuation = true

        let timeout: TimeInterval = 12.0
        return try await withThrowingTaskGroup(of: TranscriptionResult.self) { group in
            group.addTask {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<TranscriptionResult, Error>) in
                    self.recognizer.recognitionTask(with: request) { result, error in
                        if let error = error {
                            let ns = error as NSError
                            if ns.code == 1110 || ns.code == 203 || ns.code == 301 {
                                continuation.resume(throwing: TranscriptionError.speechPermissionDenied)
                            } else {
                                continuation.resume(throwing: error)
                            }
                            return
                        }
                        guard let result = result, result.isFinal else { return }
                        let text = result.bestTranscription.formattedString
                        let detected = self.recognizer.locale.identifier
                        let r = TranscriptionResult(
                            text: text,
                            language: language,
                            detectedLanguage: detected,
                            confidence: nil,
                            segments: nil,
                            duration: 0,
                            provider: self.name
                        )
                        continuation.resume(returning: r)
                    }
                }
            }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                throw TranscriptionError.recognitionFailed
            }
            // The first task to complete wins; the other is cancelled.
            guard let first = try await group.next() else {
                throw TranscriptionError.recognitionFailed
            }
            group.cancelAll()
            return first
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

                // For streaming, use the most recently detected locale or Locale.current
                let locale: Locale
                if let language = language {
                    locale = Locale(identifier: language)
                } else if let recent = SettingsStore.shared.recentLocales.first {
                    locale = Locale(identifier: recent)
                } else {
                    locale = .current
                }

                let streamRecognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer()!

                let request = SFSpeechURLRecognitionRequest(url: audioURL)
                request.shouldReportPartialResults = true
                request.addsPunctuation = true

                var lastText = ""
                streamRecognizer.recognitionTask(with: request) { result, error in
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
