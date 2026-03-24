import AVFoundation
import Foundation

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

    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    private var audioFile: AVAudioFile?
    private var levelTimer: Timer?
    private var recordingStartTime: Date?
    private var _tempRecordingURL: URL?

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
            }
        }

        try engine.start()
        isRecording = true
        recordingStartTime = Date()
        startLevelMeter()
    }

    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer, converter: AVAudioConverter) {
        guard let audioFile = audioFile else { return }

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
            try? audioFile.write(from: convertedBuffer)
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
        audioLevel = Float.random(in: 0.1...0.8)
    }

    public func stopRecording() async throws -> (url: URL, duration: TimeInterval) {
        guard isRecording else { throw AudioCaptureError.notRecording }

        levelTimer?.invalidate()
        levelTimer = nil

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
}
