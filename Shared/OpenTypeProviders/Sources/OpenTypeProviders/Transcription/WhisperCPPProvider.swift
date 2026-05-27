import Foundation
import Models
import Data

/// Local offline transcription via whisper.cpp CLI
///
/// Requires a whisper.cpp binary and a GGML model file.
/// Binary path and model path can be configured in SettingsStore.
///
/// whisper.cpp repo: https://github.com/ggerganov/whisper.cpp
public actor WhisperCPPProvider: TranscriptionProvider {
    public let name = "Whisper.cpp"

    /// Default locations checked for the whisper.cpp binary
    private let binarySearchPaths = [
        "/usr/local/bin/whisper-cpp",
        "/opt/homebrew/bin/whisper-cpp",
        "\(NSHomeDirectory())/.local/bin/whisper-cpp"
    ]

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        let binaryPath = findBinary()
        guard let binaryPath = binaryPath else {
            throw TranscriptionError.providerUnavailable
        }

        let modelPath = SettingsStore.shared.whisperModelPath
            ?? "\(NSHomeDirectory())/.cache/whisper/ggml-base.en.bin"

        // Check model exists
        guard FileManager.default.fileExists(atPath: modelPath) else {
            throw TranscriptionError.providerUnavailable
        }

        return try await withCheckedThrowingContinuation { continuation in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: binaryPath)
            process.arguments = buildArguments(audioURL: audioURL, modelPath: modelPath, language: language)

            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()
            process.standardOutput = stdoutPipe
            process.standardError = stderrPipe

            var stdoutData = Data()
            stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
                stdoutData.append(handle.availableData)
            }

            process.terminationHandler = { proc in
                stdoutPipe.fileHandleForReading.readabilityHandler = nil

                guard proc.terminationStatus == 0 else {
                    let errData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
                    let errMsg = String(data: errData, encoding: .utf8) ?? "whisper.cpp exited with code \(proc.terminationStatus)"
                    print("[WhisperCPP] Error: \(errMsg)")
                    continuation.resume(throwing: TranscriptionError.recognitionFailed)
                    return
                }

                let output = String(data: stdoutData, encoding: .utf8) ?? ""
                let text = self.parseTextOutput(output)

                let resolvedLanguage: String?
                let detectedLanguage: String?
                if language == nil {
                    let detected = self.parseLanguageFromOutput(output) ?? "en"
                    resolvedLanguage = detected
                    detectedLanguage = detected
                } else {
                    resolvedLanguage = language
                    detectedLanguage = nil
                }

                let result = TranscriptionResult(
                    text: text.trimmingCharacters(in: .whitespacesAndNewlines),
                    language: resolvedLanguage,
                    detectedLanguage: detectedLanguage,
                    confidence: nil,
                    segments: nil,
                    duration: 0,
                    provider: self.name
                )
                continuation.resume(returning: result)
            }

            do {
                try process.run()
            } catch {
                continuation.resume(throwing: TranscriptionError.providerUnavailable)
            }
        }
    }

    // MARK: - Binary discovery

    private func findBinary() -> String? {
        // Check configured path first
        if let configuredPath = SettingsStore.shared.whisperBinaryPath,
           FileManager.default.isExecutableFile(atPath: configuredPath) {
            return configuredPath
        }

        // Search known locations
        for path in binarySearchPaths {
            if FileManager.default.isExecutableFile(atPath: path) {
                return path
            }
        }

        // Try which
        let whichProcess = Process()
        whichProcess.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        whichProcess.arguments = ["whisper-cpp"]
        let pipe = Pipe()
        whichProcess.standardOutput = pipe
        do {
            try whichProcess.run()
            whichProcess.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let path = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !path.isEmpty && FileManager.default.isExecutableFile(atPath: path) {
                return path
            }
        } catch {}

        return nil
    }

    // MARK: - Arguments

    private func buildArguments(audioURL: URL, modelPath: String, language: String?) -> [String] {
        var args: [String] = [
            "-m", modelPath,
            "-f", audioURL.path,
            "-otxt",           // output plain text
            "--no-timestamps", // don't include timestamps
            "-pp"              // print progress
        ]

        if let lang = language {
            args.append(contentsOf: ["-l", lang])
        }

        return args
    }

    // MARK: - Output parsing

    /// Parse whisper.cpp text output (with `-otxt` flag)
    private nonisolated func parseTextOutput(_ output: String) -> String {
        // whisper.cpp with -otxt outputs one line per segment
        // Strip leading timestamps if present (e.g., "[00:00:00.000 --> 00:00:02.000]  text")
        let lines = output.components(separatedBy: .newlines)
        var result = ""
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty || trimmed.hasPrefix("whisper_") || trimmed.hasPrefix("system_info") {
                continue
            }

            // Remove timestamp prefix if present
            if let bracketEnd = trimmed.firstIndex(of: "]") {
                let afterBracket = trimmed[trimmed.index(after: bracketEnd)...]
                result += afterBracket.trimmingCharacters(in: .whitespaces) + " "
            } else {
                result += trimmed + " "
            }
        }
        return result.trimmingCharacters(in: .whitespaces)
    }

    /// Parse detected language from whisper.cpp stderr output
    private nonisolated func parseLanguageFromOutput(_ output: String) -> String? {
        // whisper.cpp prints "detected language: en" in stderr
        for line in output.components(separatedBy: .newlines) {
            if let range = line.range(of: "detected language:") {
                let lang = line[range.upperBound...].trimmingCharacters(in: .whitespaces)
                return lang
            }
        }
        return nil
    }
}
