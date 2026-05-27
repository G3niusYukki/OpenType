     1|import Foundation
     2|import Speech
     3|import OpenTypeModels
     4|import OpenTypeCore
     5|import OpenTypeData
     6|
     7|public class AppleSpeechProvider: TranscriptionProvider, @unchecked Sendable {
     8|    public let name = "Apple Speech"
     9|    public var supportsStreaming: Bool { true }
    10|    private let recognizer: SFSpeechRecognizer
    11|
    12|    public init(locale: Locale = .current) {
    13|        self.recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer()!
    14|    }
    15|
    16|    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
    17|        if PermissionService.shared.checkSpeechPermission() != .granted {
    18|            let status = await PermissionService.shared.requestSpeechPermission()
    19|            if status != .granted {
    20|                throw TranscriptionError.speechPermissionDenied
    21|            }
    22|        }
    23|
    24|        // Auto-detect mode: use parallel locale detection
    25|        if language == nil {
    26|            let recentLocales = SettingsStore.shared.recentLocales.prefix(3).map { Locale(identifier: $0) }
    27|            let locales = recentLocales.isEmpty ? [Locale.current] : recentLocales
    28|
    29|            let detector = AppleSpeechAutoDetector(locales: locales)
    30|            let (text, locale, confidence) = try await detector.detect(audioURL: audioURL)
    31|
    32|            let detectedIdentifier = locale.identifier
    33|
    34|            // Update recentLocales: add detected locale to front, keep max 5 unique
    35|            var updated = SettingsStore.shared.recentLocales
    36|            updated.removeAll { $0 == detectedIdentifier }
    37|            updated.insert(detectedIdentifier, at: 0)
    38|            SettingsStore.shared.recentLocales = Array(updated.prefix(5))
    39|
    40|            return TranscriptionResult(
    41|                text: text,
    42|                language: detectedIdentifier,
    43|                detectedLanguage: detectedIdentifier,
    44|                confidence: confidence,
    45|                segments: nil,
    46|                duration: 0,
    47|                provider: name
    48|            )
    49|        }
    50|
    51|        // Specific language mode: use the configured locale
    52|        let request = SFSpeechURLRecognitionRequest(url: audioURL)
    53|        request.shouldReportPartialResults = false
    54|        request.addsPunctuation = true
    55|
    56|        return try await withCheckedThrowingContinuation { continuation in
    57|            recognizer.recognitionTask(with: request) { result, error in
    58|                if let error = error {
    59|                    continuation.resume(throwing: error)
    60|                    return
    61|                }
    62|
    63|                guard let result = result, result.isFinal else { return }
    64|
    65|                let text = result.bestTranscription.formattedString
    66|                let detected = self.recognizer.locale.identifier
    67|
    68|                let transcriptionResult = TranscriptionResult(
    69|                    text: text,
    70|                    language: language,
    71|                    detectedLanguage: detected,
    72|                    confidence: nil,
    73|                    segments: nil,
    74|                    duration: 0,
    75|                    provider: self.name
    76|                )
    77|                continuation.resume(returning: transcriptionResult)
    78|            }
    79|        }
    80|    }
    81|
    82|    public func transcribeStreaming(audioURL: URL, language: String?) -> AsyncThrowingStream<String, Error> {
    83|        AsyncThrowingStream { continuation in
    84|            Task {
    85|                if PermissionService.shared.checkSpeechPermission() != .granted {
    86|                    let status = await PermissionService.shared.requestSpeechPermission()
    87|                    if status != .granted {
    88|                        continuation.finish(throwing: TranscriptionError.speechPermissionDenied)
    89|                        return
    90|                    }
    91|                }
    92|
    93|                // For streaming, use the most recently detected locale or Locale.current
    94|                let locale: Locale
    95|                if let language = language {
    96|                    locale = Locale(identifier: language)
    97|                } else if let recent = SettingsStore.shared.recentLocales.first {
    98|                    locale = Locale(identifier: recent)
    99|                } else {
   100|                    locale = .current
   101|                }
   102|
   103|                let streamRecognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer()!
   104|
   105|                let request = SFSpeechURLRecognitionRequest(url: audioURL)
   106|                request.shouldReportPartialResults = true
   107|                request.addsPunctuation = true
   108|
   109|                var lastText = ""
   110|                streamRecognizer.recognitionTask(with: request) { result, error in
   111|                    if let error = error {
   112|                        continuation.finish(throwing: error)
   113|                        return
   114|                    }
   115|
   116|                    guard let result = result else { return }
   117|
   118|                    let text = result.bestTranscription.formattedString
   119|                    if text != lastText && !text.isEmpty {
   120|                        continuation.yield(text)
   121|                        lastText = text
   122|                    }
   123|
   124|                    if result.isFinal {
   125|                        continuation.finish()
   126|                    }
   127|                }
   128|            }
   129|        }
   130|    }
   131|}
   132|