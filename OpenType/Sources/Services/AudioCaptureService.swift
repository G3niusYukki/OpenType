import AVFoundation
import Foundation
import Accelerate
import Data
import Utilities

public enum AudioCaptureError: Error {
    case notPermitted
    case engineStartFailed
    case noInputDevice
    case recordingInProgress
    case notRecording
    case fileWriteFailed
}

@MainActor
public class AudioCaptureService: ObservableObject {
    public static let shared = AudioCaptureService()

    @Published public private(set) var isRecording = false
    @Published public private(set) var audioLevel: Float = 0.0

    /// Callback fired on each audio buffer from the microphone tap.
    /// Used by RealtimeTranscriptionService to feed live audio to Apple Speech.
    /// Called on MainActor from the tap closure.
    public var onBufferReceived: ((AVAudioPCMBuffer) -> Void)?

    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    private var audioFile: AVAudioFile?
    private var levelTimer: Timer?
    private var recordingStartTime: Date?
    private var _tempRecordingURL: URL?
    private var lastAudioBuffer: AVAudioPCMBuffer?
    private let deviceWatcher = AudioDeviceWatcher()

    private var tempRecordingURL: URL {
        let tempDir = FileManager.default.temporaryDirectory
        return tempDir.appendingPathComponent("opentype_recording_\(UUID().uuidString).wav")
    }

    private init() {}

    public func startRecording() async throws {
        if PermissionService.shared.checkMicrophonePermission() != .granted {
            let status = await PermissionService.shared.requestMicrophonePermission()
            if status != .granted {
                throw AudioCaptureError.notPermitted
            }
        }

        guard !isRecording else { throw AudioCaptureError.recordingInProgress }

        audioEngine = AVAudioEngine()
        guard let engine = audioEngine else { throw AudioCaptureError.engineStartFailed }

        inputNode = engine.inputNode
        guard let inputNode = inputNode else { throw AudioCaptureError.noInputDevice }

        let format = inputNode.outputFormat(forBus: 0)
        let recordingFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 16000,
            channels: 1,
            interleaved: false
        )!

        guard let converter = AVAudioConverter(from: format, to: recordingFormat) else {
            throw AudioCaptureError.engineStartFailed
        }

        _tempRecordingURL = tempRecordingURL
        audioFile = try AVAudioFile(
            forWriting: _tempRecordingURL!,
            settings: recordingFormat.settings,
            commonFormat: .pcmFormatFloat32,
            interleaved: false
        )

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            Task { @MainActor in
                self?.processAudioBuffer(buffer, converter: converter)
                self?.onBufferReceived?(buffer)
            }
        }

        try engine.start()
        isRecording = true
        recordingStartTime = Date()
        startLevelMeter()

        // Watch for device changes during recording
        deviceWatcher.onDeviceChanged = { [weak self] _, newDevice in
            guard let self = self, self.isRecording else { return }
            if newDevice == nil {
                // Device disconnected — gracefully stop recording
                Task { @MainActor in
                    _ = try? await self.stopRecording()
                }
            }
        }
        deviceWatcher.startWatching()
    }

    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, converter: AVAudioConverter) {
        guard let audioFile = audioFile else { return }

        // Store buffer for level metering
        lastAudioBuffer = buffer

        let frameCapacity = AVAudioFrameCount(
            Double(buffer.frameLength) * 16000.0 / buffer.format.sampleRate
        )
        guard let convertedBuffer = AVAudioPCMBuffer(
            pcmFormat: converter.outputFormat,
            frameCapacity: frameCapacity
        ) else { return }

        var error: NSError?
        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
            outStatus.pointee = .haveData
            return buffer
        }

        converter.convert(to: convertedBuffer, error: &error, withInputFrom: inputBlock)

        if error == nil {
            // Apply Whisper Mode processing if enabled
            if SettingsStore.shared.whisperModeEnabled {
                applyWhisperProcessing(to: convertedBuffer)
            }
            try? audioFile.write(from: convertedBuffer)
        }
    }

    // MARK: - Whisper Mode Audio Processing

    /// Applies noise gate + AGC (Automatic Gain Control) to boost quiet speech
    /// and suppress background noise for Whisper Mode.
    private func applyWhisperProcessing(to buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData else { return }
        let frameLength = Int(buffer.frameLength)
        let samples = channelData[0]

        // --- Noise Gate ---
        // Compute RMS of the buffer to estimate ambient noise floor
        var rms: Float = 0
        vDSP_rmsqv(samples, 1, &rms, vDSP_Length(frameLength))

        // Adaptive noise gate threshold: slightly above the estimated noise floor
        // For whisper mode, we use a very low threshold to capture quiet speech
        let noiseGateThreshold: Float = max(rms * 0.3, 0.002)

        // Apply soft noise gate (gradual attenuation below threshold, not hard cutoff)
        for i in 0..<frameLength {
            let absSample = abs(samples[i])
            if absSample < noiseGateThreshold {
                // Attenuate noise below threshold (soft knee)
                let attenuation = absSample / noiseGateThreshold
                samples[i] *= attenuation * attenuation
            }
        }

        // --- Automatic Gain Control (AGC) ---
        // Boost quiet signals to make whispered speech audible
        // Target RMS for comfortable speech level
        let targetRMS: Float = 0.12
        var currentRMS: Float = 0
        vDSP_rmsqv(samples, 1, &currentRMS, vDSP_Length(frameLength))

        if currentRMS > 0.001 { // Only apply gain if there's actual signal
            let gain = min(targetRMS / currentRMS, 6.0) // Cap at 6x to avoid distortion

            // Apply gain
            var gainValue = gain
            vDSP_vsmul(samples, 1, &gainValue, samples, 1, vDSP_Length(frameLength))

            // Soft clip to prevent distortion (tanh-based limiter)
            for i in 0..<frameLength {
                if abs(samples[i]) > 0.9 {
                    samples[i] = tanh(samples[i])
                }
            }
        }
    }

    private func startLevelMeter() {
        levelTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateAudioLevel()
            }
        }
    }

    private func updateAudioLevel() {
        guard isRecording else { return }
        
        // Calculate RMS (Root Mean Square) from the last audio buffer
        guard let buffer = lastAudioBuffer,
              let channelData = buffer.floatChannelData else {
            audioLevel = 0.0
            return
        }
        
        let frameLength = Int(buffer.frameLength)
        let channelDataPointer = channelData[0]
        var sum: Float = 0.0
        
        for i in 0..<frameLength {
            let sample = channelDataPointer[i]
            sum += sample * sample
        }
        
        let rms = sqrt(sum / Float(frameLength))
        
        // Convert to logarithmic scale (dB) and normalize to 0.0-1.0
        // Typical range: -60dB (quiet) to 0dB (loud)
        let db = 20.0 * log10(max(rms, 0.0001))

        // In Whisper Mode, use a wider dynamic range to show quieter sounds
        let whisperMode = SettingsStore.shared.whisperModeEnabled
        let dbFloor: Float = whisperMode ? -70.0 : -60.0
        let dbRange: Float = whisperMode ? 70.0 : 60.0
        let normalizedLevel = (db - dbFloor) / dbRange
        
        // Apply smoothing and clamp to valid range
        let targetLevel = max(0.0, min(1.0, normalizedLevel))
        audioLevel = audioLevel * 0.7 + targetLevel * 0.3
    }

    public func stopRecording() async throws -> (url: URL, duration: TimeInterval) {
        guard isRecording else { throw AudioCaptureError.notRecording }

        levelTimer?.invalidate()
        levelTimer = nil
        deviceWatcher.stopWatching()

        inputNode?.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        inputNode = nil

        let duration = recordingStartTime.map { Date().timeIntervalSince($0) } ?? 0
        guard let url = _tempRecordingURL else { throw AudioCaptureError.fileWriteFailed }

        audioFile = nil
        isRecording = false
        audioLevel = 0

        return (url, duration)
    }

    public func getRecordingDuration() -> TimeInterval {
        recordingStartTime.map { Date().timeIntervalSince($0) } ?? 0
    }

    public func cleanupTempFiles(keepingRecent: Int = 20) {
        let tempDir = FileManager.default.temporaryDirectory
        do {
            let files = try FileManager.default.contentsOfDirectory(
                at: tempDir,
                includingPropertiesForKeys: [.creationDateKey]
            ).filter { $0.lastPathComponent.hasPrefix("opentype_recording_") }

            let sorted = files.sorted { a, b in
                let dateA = (try? a.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date.distantPast
                let dateB = (try? b.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date.distantPast
                return dateA > dateB
            }

            for file in sorted.dropFirst(keepingRecent) {
                try? FileManager.default.removeItem(at: file)
            }
        } catch {
            print("Failed to cleanup temp files: \(error)")
        }
    }
}
