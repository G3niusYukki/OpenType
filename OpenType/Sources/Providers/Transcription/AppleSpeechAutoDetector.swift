import Data
import Foundation
import Models
import Speech

class AppleSpeechAutoDetector {
    private let locales: [Locale]
    private let timeout: TimeInterval

    /// - Parameter timeout: per-locale timeout in seconds. If the recognizer
    ///   doesn't report `isFinal` within this window, the detector returns
    ///   the best partial it has (or empty if there is none). Prevents
    ///   silent-recording hangs from leaking the UI continuation.
    init(locales: [Locale], timeout: TimeInterval = 12.0) {
        self.locales = locales
        self.timeout = timeout
    }

    func detect(audioURL: URL) async throws -> (text: String, locale: Locale, confidence: Float) {
        if locales.isEmpty {
            return ("", Locale.current, 0.0)
        }
        return try await withThrowingTaskGroup(of: (String, Locale, Float).self) { group in
            for locale in self.locales {
                group.addTask {
                    try await self.detectOne(audioURL: audioURL, locale: locale)
                }
            }
            var bestResult: (String, Locale, Float) = ("", self.locales.first ?? Locale.current, 0.0)
            for try await result in group {
                if result.2 > bestResult.2 {
                    bestResult = result
                }
            }
            return bestResult
        }
    }

    /// Race the recognizer against a timeout. First to finish wins; the other
    /// task is cancelled. The recognizer task is intentionally non-throwing
    /// (errors are converted to empty results) so the group never throws.
    private func detectOne(audioURL: URL, locale: Locale) async throws -> (String, Locale, Float) {
        guard let recognizer = SFSpeechRecognizer(locale: locale) else {
            return ("", locale, 0.0)
        }
        let request = SFSpeechURLRecognitionRequest(url: audioURL)
        request.shouldReportPartialResults = false
        request.addsPunctuation = true

        let timeout = self.timeout
        return try await withThrowingTaskGroup(of: (String, Locale, Float).self) { group in
            group.addTask {
                await self.recognizeWithRecognizer(recognizer, request: request, locale: locale)
            }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                return ("", locale, 0.0)
            }
            let first = try await group.next()!
            group.cancelAll()
            return first
        }
    }

    private func recognizeWithRecognizer(
        _ recognizer: SFSpeechRecognizer,
        request: SFSpeechURLRecognitionRequest,
        locale: Locale
    ) async -> (String, Locale, Float) {
        await withCheckedContinuation { (continuation: CheckedContinuation<(String, Locale, Float), Never>) in
            recognizer.recognitionTask(with: request) { result, error in
                if let error = error {
                    // Treat "no speech" and similar recoverable errors as empty.
                    let ns = error as NSError
                    if ns.code == 1110 || ns.code == 203 || ns.code == 301 {
                        continuation.resume(returning: ("", locale, 0.0))
                    } else {
                        // Unknown error: surface as empty so we don't hang.
                        continuation.resume(returning: ("", locale, 0.0))
                    }
                    return
                }
                guard let result = result, result.isFinal else { return }
                let segments = result.bestTranscription.segments
                let avgConfidence: Float = segments.isEmpty
                    ? 0.0
                    : segments.map(\.confidence).reduce(0, +) / Float(segments.count)
                continuation.resume(returning: (
                    result.bestTranscription.formattedString,
                    locale,
                    avgConfidence
                ))
            }
        }
    }
}
