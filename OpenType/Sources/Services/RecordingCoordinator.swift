import AppKit
import Combine
import Models
import Utilities

/// Coordinates the recording lifecycle: audio capture, realtime transcription, and VAD.
/// Extracted from PopoverViewModel to reduce its 561-line god class.
@MainActor
public final class RecordingCoordinator: ObservableObject {
    @Published public var isRecording = false
    @Published public var liveText = ""

    /// Accumulated finalized segments from realtime transcription.
    public private(set) var accumulatedLiveText = ""

    /// True once VAD has triggered AI processing in this recording session.
    public var didPauseProcess = false

    /// Called when VAD detects a speech pause.
    public var onPauseDetected: (() -> Void)?

    private let audioService = AudioCaptureService.shared
    private let realtimeTranscription = RealtimeTranscriptionService.shared
    private let vadDetector = VADDetector.shared
    private var levelCancellable: AnyCancellable?

    public init() {}

    // MARK: - Start

    public func start(mode _: VoiceMode) async throws {
        accumulatedLiveText = ""
        liveText = ""
        didPauseProcess = false
        isRecording = true

        try await audioService.startRecording()

        // Wire audio buffer to realtime transcription
        audioService.onBufferReceived = { [weak self] buffer in
            self?.realtimeTranscription.appendBuffer(buffer)
        }

        // Start realtime transcription (Apple Speech)
        try realtimeTranscription.start()

        // Wire partial results to liveText
        realtimeTranscription.onPartialResult = { [weak self] text in
            Task { @MainActor in
                self?.liveText = text
            }
        }

        // Accumulate finalized segments
        realtimeTranscription.onSegmentFinalized = { [weak self] segment in
            Task { @MainActor in
                guard let self = self else { return }
                if self.accumulatedLiveText.isEmpty {
                    self.accumulatedLiveText = segment
                } else {
                    self.accumulatedLiveText += " " + segment
                }
            }
        }

        // Wire VAD pause detection
        vadDetector.onPauseDetected = { [weak self] in
            Task { @MainActor in
                self?.onPauseDetected?()
            }
        }
        vadDetector.start()

        // Feed audio levels to VAD via Combine
        levelCancellable = audioService.$audioLevel
            .sink { [weak self] level in
                self?.vadDetector.updateAudioLevel(level)
            }
    }

    // MARK: - Stop

    public func stop() async throws -> (url: URL, duration: TimeInterval) {
        isRecording = false

        // Tear down realtime transcription and VAD
        realtimeTranscription.stop()
        vadDetector.stop()
        levelCancellable?.cancel()
        levelCancellable = nil
        audioService.onBufferReceived = nil

        return try await audioService.stopRecording()
    }

    /// Combined text from realtime transcription or accumulated segments.
    public var fullText: String {
        let rt = realtimeTranscription.fullText
        return rt.isEmpty ? accumulatedLiveText : rt
    }

    // MARK: - Cleanup

    public func reset() {
        liveText = ""
        accumulatedLiveText = ""
        didPauseProcess = false
    }
}
