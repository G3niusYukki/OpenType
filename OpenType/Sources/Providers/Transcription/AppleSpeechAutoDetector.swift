import Speech
import Foundation
import Models
import Data

class AppleSpeechAutoDetector {
    private let locales: [Locale]

    init(locales: [Locale]) {
        self.locales = locales
    }

    func detect(audioURL: URL) async throws -> (text: String, locale: Locale, confidence: Float) {
        try await withThrowingTaskGroup(of: (String, Locale, Float).self) { group in
            for locale in self.locales {
                group.addTask {
                    guard let recognizer = SFSpeechRecognizer(locale: locale) else {
                        return ("", locale, 0.0)
                    }
                    let request = SFSpeechURLRecognitionRequest(url: audioURL)
                    request.shouldReportPartialResults = false
                    request.addsPunctuation = true

                    let result = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<SFSpeechRecognitionResult, Error>) in
                        recognizer.recognitionTask(with: request) { result, error in
                            if let result = result, result.isFinal {
                                continuation.resume(returning: result)
                            } else if let error = error {
                                continuation.resume(throwing: error)
                            }
                        }
                    }

                    let avgConfidence: Float
                    let segments = result.bestTranscription.segments
                    if segments.isEmpty {
                        avgConfidence = 0.0
                    } else {
                        avgConfidence = segments.map(\.confidence).reduce(0, +) / Float(segments.count)
                    }

                    return (result.bestTranscription.formattedString, locale, avgConfidence)
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
}