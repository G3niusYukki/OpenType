import AVFoundation
import Data
import Foundation
import Models
import Providers
import Speech
import Utilities

/// Real-time streaming transcription using SFSpeechAudioBufferRecognitionRequest.
/// Unlike file-based transcription, this feeds live audio buffers directly to Apple Speech
/// for near-instant partial results as the user speaks.
@MainActor
public class RealtimeTranscriptionService: ObservableObject {
    public static let shared = RealtimeTranscriptionService()

    @Published public private(set) var isTranscribing = false
    @Published public private(set) var partialText = ""
    @Published public private(set) var finalSegments: [String] = []

    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    /// Callback fired on each partial result update
    public var onPartialResult: ((String) -> Void)?
    /// Callback fired when a segment is finalized (sentence boundary)
    public var onSegmentFinalized: ((String) -> Void)?
    /// Callback fired on error
    public var onError: ((Error) -> Void)?

    private init() {}

    /// Start real-time transcription. Call this AFTER AudioCaptureService.startRecording().
    /// Audio buffers must be fed via `appendBuffer()` from the audio engine tap.
    public func start(locale: Locale? = nil) throws {
        guard !isTranscribing else { return }

        // Choose locale
        let effectiveLocale: Locale
        if let locale = locale {
            effectiveLocale = locale
        } else if let recent = SettingsStore.shared.recentLocales.first {
            effectiveLocale = Locale(identifier: recent)
        } else {
            effectiveLocale = .current
        }

        guard let recognizer = SFSpeechRecognizer(locale: effectiveLocale), recognizer.isAvailable else {
            throw TranscriptionError.speechPermissionDenied
        }
        speechRecognizer = recognizer

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true

        // Enable on-device recognition when available (macOS 13+)
        if #available(macOS 13, *) {
            request.requiresOnDeviceRecognition = false // Prefer on-device but allow cloud fallback
        }

        recognitionRequest = request

        // Reset state
        partialText = ""
        finalSegments = []

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                self?.handleRecognitionResult(result: result, error: error)
            }
        }

        isTranscribing = true
    }

    /// Feed an audio buffer from the audio engine tap.
    /// Must be called on the audio thread — this method is safe to call from any thread.
    public func appendBuffer(_ buffer: AVAudioPCMBuffer) {
        recognitionRequest?.append(buffer)
    }

    /// Stop transcription and finalize remaining audio.
    public func stop() {
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        speechRecognizer = nil
        isTranscribing = false
    }

    /// Get the full accumulated text (all finalized segments + current partial).
    public var fullText: String {
        let segments = finalSegments.joined(separator: " ")
        if partialText.isEmpty {
            return segments
        }
        return segments.isEmpty ? partialText : "\(segments) \(partialText)"
    }

    // MARK: - Private

    private func handleRecognitionResult(result: SFSpeechRecognitionResult?, error: Error?) {
        if let error = error {
            // Don't report cancellation errors
            if (error as NSError).code != 216 { // kAFAssistantErrorDomain code 216 = task cancelled
                onError?(error)
            }
            return
        }

        guard let result = result else { return }

        let text = result.bestTranscription.formattedString

        if result.isFinal {
            // This is a final result for the entire recognition session
            if !text.isEmpty {
                finalSegments.append(text)
                onSegmentFinalized?(text)
            }
            partialText = ""
        } else {
            // Partial result — update live text
            partialText = text
            onPartialResult?(fullText)
        }
    }
}
