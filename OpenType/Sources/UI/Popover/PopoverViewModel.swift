import SwiftUI
import AppKit
import Models
import Services
import Data

@MainActor
class PopoverViewModel: ObservableObject {
    @Published var isRecording = false
    @Published var isProcessing = false
    @Published var transcribedText = ""
    @Published var recentHistory: [HistoryEntry] = []
    @Published var currentMode: VoiceMode = .basic

    private let audioService = AudioCaptureService.shared
    private let transcriptionService = TranscriptionService.shared
    private let aiService = AIProcessingService.shared
    private let textInserter = TextInsertionService.shared

    init() {
        recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)
    }

    func startRecording(mode: VoiceMode) {
        currentMode = mode
        isRecording = true
        transcribedText = ""

        Task {
            do {
                try await audioService.startRecording()
            } catch {
                print("Failed to start recording: \(error)")
                isRecording = false
            }
        }
    }

    func stopRecording() {
        isRecording = false
        isProcessing = true

        Task {
            do {
                // Step 1: Stop audio capture and get URL + duration
                let (url, duration) = try await audioService.stopRecording()

                // Step 2: Transcribe audio
                let result = try await transcriptionService.transcribe(audioURL: url)

                // Step 3: Run AI processing if available
                var processedText = result.text
                if aiService.isAvailable() {
                    processedText = try await aiService.process(text: result.text)
                }

                // Step 4: Save to history
                let entry = HistoryEntry(
                    audioPath: url.path,
                    originalText: result.text,
                    processedText: processedText,
                    mode: currentMode,
                    provider: result.provider,
                    duration: duration,
                    language: result.language ?? "en"
                )
                try? HistoryStore.shared.saveHistoryEntry(entry)

                // Step 5: Update UI state
                transcribedText = processedText
                recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)
                isProcessing = false
            } catch {
                print("Transcription pipeline failed: \(error)")
                transcribedText = "Error: \(error.localizedDescription)"
                isProcessing = false
            }
        }
    }

    func insertText() {
        do {
            try textInserter.insertText(transcribedText)
        } catch {
            print("Text insertion failed, falling back to clipboard: \(error)")
            copyToClipboard(transcribedText)
        }
    }

    func openHistory() {
        NotificationCenter.default.post(name: .openHistoryWindow, object: nil)
    }

    func openSettings() {
        NotificationCenter.default.post(name: .openSettingsWindow, object: nil)
    }

    func copyToClipboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
}

extension Notification.Name {
    public static let openHistoryWindow = Notification.Name("openHistoryWindow")
    public static let openSettingsWindow = Notification.Name("openSettingsWindow")
    public static let openDiagnosticsWindow = Notification.Name("openDiagnosticsWindow")
}
