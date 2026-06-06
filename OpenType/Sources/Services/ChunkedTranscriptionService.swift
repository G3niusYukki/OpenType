import AVFoundation
import Foundation
import Models
import Providers

/// Splits audio into chunks and transcribes them incrementally for near-real-time results.
/// Used by cloud transcription providers (Whisper, Groq) which don't support native streaming.
public actor ChunkedTranscriptionService {
    private let chunkDuration: TimeInterval = 5.0
    private let overlapDuration: TimeInterval = 1.0

    public init() {}

    /// Transcribe an audio file in chunks, yielding accumulated results as each chunk completes.
    /// nonisolated: only captures `let` config; the Task inside calls actor methods with `await`.
    public nonisolated func transcribeChunked(
        audioURL: URL,
        provider: TranscriptionProvider,
        language: String?
    ) -> AsyncThrowingStream<String, Error> {
        let chunkDuration = self.chunkDuration
        let overlapDuration = self.overlapDuration

        return AsyncThrowingStream { continuation in
            Task {
                do {
                    let asset = AVURLAsset(url: audioURL)
                    let duration = try await asset.load(.duration)
                    let totalSeconds = CMTimeGetSeconds(duration)

                    guard totalSeconds > 0 else {
                        continuation.finish()
                        return
                    }

                    var accumulatedText = ""
                    var currentTime: TimeInterval = 0
                    let step = max(chunkDuration - overlapDuration, 1.0)

                    while currentTime < totalSeconds {
                        let chunkEnd = min(currentTime + chunkDuration, totalSeconds)

                        let chunkURL = try await self.extractChunk(
                            from: audioURL,
                            start: currentTime,
                            end: chunkEnd
                        )

                        let result = try await provider.transcribe(audioURL: chunkURL, language: language)
                        try? FileManager.default.removeItem(at: chunkURL)

                        let newText = self.deduplicateOverlap(
                            existing: accumulatedText,
                            new: result.text
                        )

                        if !newText.isEmpty {
                            accumulatedText += (accumulatedText.isEmpty ? "" : " ") + newText
                            continuation.yield(accumulatedText)
                        }

                        currentTime += step
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Internal (testable)

    /// Extract a time range from an audio file into a temporary file.
    func extractChunk(from sourceURL: URL, start: TimeInterval, end: TimeInterval) async throws -> URL {
        let asset = AVURLAsset(url: sourceURL)
        let duration = try await asset.load(.duration)

        let startTime = CMTime(seconds: start, preferredTimescale: 600)
        let endTime = CMTime(seconds: min(end, CMTimeGetSeconds(duration)), preferredTimescale: 600)
        let timeRange = CMTimeRange(start: startTime, end: endTime)

        let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A)!
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("chunk_\(UUID().uuidString).m4a")

        exportSession.outputURL = tempURL
        exportSession.outputFileType = .m4a
        exportSession.timeRange = timeRange

        await exportSession.export()

        guard exportSession.status == .completed else {
            throw TranscriptionError.recognitionFailed
        }

        return tempURL
    }

    /// Overlap deduplication: if the tail of `existing` matches the prefix of `new`,
    /// return only the non-overlapping suffix.
    nonisolated func deduplicateOverlap(existing: String, new: String) -> String {
        guard !existing.isEmpty else { return new }

        let existingWords = existing.split(separator: " ").map(String.init)
        let newWords = new.split(separator: " ").map(String.init)

        for overlapCount in stride(from: min(existingWords.count, newWords.count), through: 1, by: -1) {
            let existingSuffix = Array(existingWords.suffix(overlapCount))
            let newPrefix = Array(newWords.prefix(overlapCount))

            if existingSuffix == newPrefix {
                return newWords.dropFirst(overlapCount).joined(separator: " ")
            }
        }

        return new
    }
}
