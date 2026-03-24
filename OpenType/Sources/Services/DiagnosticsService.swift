import Foundation
import CoreAudio
import AudioToolbox
import Utilities
import Models

public class DiagnosticsService {
    public static let shared = DiagnosticsService()

    private init() {}

    public func runAllDiagnostics() async -> [DiagnosticResult] {
        var results: [DiagnosticResult] = []

        // Microphone permission
        let micStatus = PermissionService.shared.checkMicrophonePermission()
        if micStatus == .notDetermined {
            let newStatus = await PermissionService.shared.requestMicrophonePermission()
            results.append(makeMicResult(status: newStatus))
        } else {
            results.append(makeMicResult(status: micStatus))
        }

        // Speech recognition permission
        let speechStatus = PermissionService.shared.checkSpeechPermission()
        if speechStatus == .notDetermined {
            let newStatus = await PermissionService.shared.requestSpeechPermission()
            results.append(makeSpeechResult(status: newStatus))
        } else {
            results.append(makeSpeechResult(status: speechStatus))
        }

        // Accessibility
        results.append(checkAccessibilityPermission())

        // Audio devices
        results.append(checkAudioDevices())

        // Network
        results.append(await checkNetwork())

        // Storage
        results.append(checkStorage())

        // FFmpeg — not required, using Apple Speech Framework
        results.append(DiagnosticResult(
            name: "FFmpeg Availability",
            status: .skipped,
            details: "FFmpeg is not required — the native app uses Apple Speech Framework for transcription.",
            suggestion: nil
        ))

        return results
    }

    private func makeMicResult(status: PermissionStatus) -> DiagnosticResult {
        switch status {
        case .granted:
            return DiagnosticResult(name: "Microphone Permission", status: .pass, details: "Microphone access is granted.")
        case .denied:
            return DiagnosticResult(
                name: "Microphone Permission",
                status: .fail,
                details: "Microphone access is denied.",
                suggestion: "Open System Settings > Privacy & Security > Microphone and enable it for OpenType."
            )
        case .notDetermined:
            return DiagnosticResult(
                name: "Microphone Permission",
                status: .fail,
                details: "Microphone access is denied."
            )
        }
    }

    private func makeSpeechResult(status: PermissionStatus) -> DiagnosticResult {
        switch status {
        case .granted:
            return DiagnosticResult(name: "Speech Recognition Permission", status: .pass, details: "Speech recognition access is granted.")
        case .denied:
            return DiagnosticResult(
                name: "Speech Recognition Permission",
                status: .fail,
                details: "Speech recognition access is denied.",
                suggestion: "Open System Settings > Privacy & Security > Speech Recognition and enable it for OpenType."
            )
        case .notDetermined:
            return DiagnosticResult(
                name: "Speech Recognition Permission",
                status: .fail,
                details: "Speech recognition access was denied."
            )
        }
    }

    private func checkAccessibilityPermission() -> DiagnosticResult {
        let hasAccess = PermissionService.shared.checkAccessibilityPermission()
        if hasAccess {
            return DiagnosticResult(
                name: "Accessibility Permission",
                status: .pass,
                details: "Accessibility access is granted."
            )
        } else {
            return DiagnosticResult(
                name: "Accessibility Permission",
                status: .fail,
                details: "Accessibility access is required for hotkeys.",
                suggestion: "Open System Settings > Privacy & Security > Accessibility and enable it for OpenType."
            )
        }
    }

    private func checkAudioDevices() -> DiagnosticResult {
        var propertyAddress = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDevices,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )

        var dataSize: UInt32 = 0
        var status = AudioObjectGetPropertyDataSize(
            AudioObjectID(kAudioObjectSystemObject),
            &propertyAddress,
            0,
            nil,
            &dataSize
        )

        guard status == noErr else {
            return DiagnosticResult(
                name: "Audio Devices",
                status: .fail,
                details: "Failed to query audio devices: \(status)",
                suggestion: "Check that your microphone is connected and not in use by another application."
            )
        }

        let deviceCount = Int(dataSize) / MemoryLayout<AudioDeviceID>.size
        var deviceIDs = [AudioDeviceID](repeating: 0, count: deviceCount)

        status = AudioObjectGetPropertyData(
            AudioObjectID(kAudioObjectSystemObject),
            &propertyAddress,
            0,
            nil,
            &dataSize,
            &deviceIDs
        )

        guard status == noErr else {
            return DiagnosticResult(
                name: "Audio Devices",
                status: .fail,
                details: "Failed to get audio device list: \(status)",
                suggestion: "Check that your microphone is connected and not in use by another application."
            )
        }

        var inputDevices: [(id: AudioDeviceID, name: String)] = []

        for deviceID in deviceIDs {
            // Check if device has input channels
            var inputAddress = AudioObjectPropertyAddress(
                mSelector: kAudioDevicePropertyStreamConfiguration,
                mScope: kAudioDevicePropertyScopeInput,
                mElement: kAudioObjectPropertyElementMain
            )

            var inputSize: UInt32 = 0
            status = AudioObjectGetPropertyDataSize(deviceID, &inputAddress, 0, nil, &inputSize)

            if status == noErr && inputSize > 0 {
                let bufferList = UnsafeMutablePointer<AudioBufferList>.allocate(capacity: 1)
                defer { bufferList.deallocate() }

                status = AudioObjectGetPropertyData(deviceID, &inputAddress, 0, nil, &inputSize, bufferList)

                if status == noErr {
                    let buffers = UnsafeMutableAudioBufferListPointer(bufferList)
                    let channelCount = buffers.reduce(0) { $0 + Int($1.mNumberChannels) }
                    if channelCount > 0 {
                        // Get device name
                        var nameAddress = AudioObjectPropertyAddress(
                            mSelector: kAudioDevicePropertyDeviceNameCFString,
                            mScope: kAudioObjectPropertyScopeGlobal,
                            mElement: kAudioObjectPropertyElementMain
                        )
                        var deviceName: CFString = "" as CFString
                        var nameSize = UInt32(MemoryLayout<CFString>.size)
                        let nameStatus = AudioObjectGetPropertyData(deviceID, &nameAddress, 0, nil, &nameSize, &deviceName)
                        let name = nameStatus == noErr ? deviceName as String : "Unknown Device"
                        inputDevices.append((id: deviceID, name: name))
                    }
                }
            }
        }

        if inputDevices.isEmpty {
            return DiagnosticResult(
                name: "Audio Devices",
                status: .warning,
                details: "No audio input devices found.",
                suggestion: "Connect a microphone or ensure your Mac's built-in microphone is selected."
            )
        } else {
            let deviceNames = inputDevices.map { $0.name }.joined(separator: ", ")
            return DiagnosticResult(
                name: "Audio Devices",
                status: .pass,
                details: "Found \(inputDevices.count) input device(s): \(deviceNames)."
            )
        }
    }

    private func checkNetwork() async -> DiagnosticResult {
        guard let url = URL(string: "https://www.apple.com") else {
            return DiagnosticResult(
                name: "Network",
                status: .fail,
                details: "Could not create test URL."
            )
        }

        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 5.0

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                return DiagnosticResult(
                    name: "Network",
                    status: .pass,
                    details: "Network connectivity is working."
                )
            } else {
                return DiagnosticResult(
                    name: "Network",
                    status: .fail,
                    details: "Network request returned an unexpected status."
                )
            }
        } catch {
            return DiagnosticResult(
                name: "Network",
                status: .warning,
                details: "Network connectivity check failed: \(error.localizedDescription)",
                suggestion: "Check your internet connection. Cloud transcription and AI features will not work without network access."
            )
        }
    }

    private func checkStorage() -> DiagnosticResult {
        let fileManager = FileManager.default
        guard let appSupportURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return DiagnosticResult(
                name: "Storage",
                status: .fail,
                details: "Could not locate Application Support directory."
            )
        }

        let openTypeDir = appSupportURL.appendingPathComponent(Constants.appBundleIdentifier)

        do {
            if !fileManager.fileExists(atPath: openTypeDir.path) {
                try fileManager.createDirectory(at: openTypeDir, withIntermediateDirectories: true)
            }

            let resourceValues = try openTypeDir.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
            if let capacity = resourceValues.volumeAvailableCapacityForImportantUsage {
                let capacityMB = capacity / (1024 * 1024)
                if capacityMB < 100 {
                    return DiagnosticResult(
                        name: "Storage",
                        status: .warning,
                        details: "Only \(capacityMB) MB available in Application Support.",
                        suggestion: "Free up disk space to ensure recordings and history are saved properly."
                    )
                } else {
                    return DiagnosticResult(
                        name: "Storage",
                        status: .pass,
                        details: "Sufficient storage available (\(capacityMB) MB free)."
                    )
                }
            } else {
                return DiagnosticResult(
                    name: "Storage",
                    status: .skipped,
                    details: "Could not determine storage capacity."
                )
            }
        } catch {
            return DiagnosticResult(
                name: "Storage",
                status: .fail,
                details: "Failed to check/create app directory: \(error.localizedDescription)"
            )
        }
    }
}
