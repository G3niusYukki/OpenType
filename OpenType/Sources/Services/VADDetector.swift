import Foundation

/// Voice Activity Detection (VAD) — detects pauses in speech
/// to trigger AI post-processing during real-time transcription.
@MainActor
public class VADDetector: ObservableObject {
    public static let shared = VADDetector()

    /// Minimum silence duration (seconds) to consider a pause
    public var silenceThreshold: TimeInterval = 1.2

    /// Minimum speech duration before a pause counts (avoid triggering on short hesitations)
    public var minSpeechDuration: TimeInterval = 0.5

    /// Callback fired when a pause is detected
    public var onPauseDetected: (() -> Void)?

    @Published public private(set) var isSpeaking = false
    @Published public private(set) var silenceDuration: TimeInterval = 0

    private var lastSpeechTime: Date?
    private var speechStartTime: Date?
    private var monitorTimer: Timer?
    private var lastAudioLevel: Float = 0

    /// Audio level below this is considered silence (0.0-1.0 scale)
    private let silenceLevelThreshold: Float = 0.03

    private init() {}

    /// Start monitoring audio levels for VAD.
    /// Call `updateAudioLevel()` periodically (e.g., from the level meter timer).
    public func start() {
        isSpeaking = false
        silenceDuration = 0
        lastSpeechTime = nil
        speechStartTime = nil

        monitorTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkPause()
            }
        }
    }

    /// Stop monitoring.
    public func stop() {
        monitorTimer?.invalidate()
        monitorTimer = nil
        isSpeaking = false
        silenceDuration = 0
    }

    /// Feed the current audio level (0.0-1.0) from the audio engine.
    /// Should be called at ~20Hz (every 50ms) from the level meter.
    public func updateAudioLevel(_ level: Float) {
        lastAudioLevel = level

        if level > silenceLevelThreshold {
            // Speech detected
            if !isSpeaking {
                isSpeaking = true
                speechStartTime = Date()
            }
            lastSpeechTime = Date()
            silenceDuration = 0
        }
    }

    // MARK: - Private

    private func checkPause() {
        guard isSpeaking, let lastSpeech = lastSpeechTime else { return }

        let now = Date()
        silenceDuration = now.timeIntervalSince(lastSpeech)

        // Check if we've been silent long enough
        if silenceDuration >= silenceThreshold {
            // Also check minimum speech duration to avoid false triggers
            if let speechStart = speechStartTime,
               lastSpeech.timeIntervalSince(speechStart) >= minSpeechDuration
            {
                isSpeaking = false
                silenceDuration = 0
                speechStartTime = nil
                lastSpeechTime = nil
                onPauseDetected?()
            }
        }
    }
}
