     1|import Speech
     2|import Foundation
     3|import OpenTypeModels
     4|import OpenTypeData
     5|
     6|class AppleSpeechAutoDetector {
     7|    private let locales: [Locale]
     8|
     9|    init(locales: [Locale]) {
    10|        self.locales = locales
    11|    }
    12|
    13|    func detect(audioURL: URL) async throws -> (text: String, locale: Locale, confidence: Float) {
    14|        try await withThrowingTaskGroup(of: (String, Locale, Float).self) { group in
    15|            for locale in self.locales {
    16|                group.addTask {
    17|                    guard let recognizer = SFSpeechRecognizer(locale: locale) else {
    18|                        return ("", locale, 0.0)
    19|                    }
    20|                    let request = SFSpeechURLRecognitionRequest(url: audioURL)
    21|                    request.shouldReportPartialResults = false
    22|                    request.addsPunctuation = true
    23|
    24|                    let result = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<SFSpeechRecognitionResult, Error>) in
    25|                        recognizer.recognitionTask(with: request) { result, error in
    26|                            if let result = result, result.isFinal {
    27|                                continuation.resume(returning: result)
    28|                            } else if let error = error {
    29|                                continuation.resume(throwing: error)
    30|                            }
    31|                        }
    32|                    }
    33|
    34|                    let avgConfidence: Float
    35|                    let segments = result.bestTranscription.segments
    36|                    if segments.isEmpty {
    37|                        avgConfidence = 0.0
    38|                    } else {
    39|                        avgConfidence = segments.map(\.confidence).reduce(0, +) / Float(segments.count)
    40|                    }
    41|
    42|                    return (result.bestTranscription.formattedString, locale, avgConfidence)
    43|                }
    44|            }
    45|
    46|            var bestResult: (String, Locale, Float) = ("", self.locales.first ?? Locale.current, 0.0)
    47|            for try await result in group {
    48|                if result.2 > bestResult.2 {
    49|                    bestResult = result
    50|                }
    51|            }
    52|            return bestResult
    53|        }
    54|    }
    55|}