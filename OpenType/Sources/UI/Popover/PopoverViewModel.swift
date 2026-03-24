import SwiftUI
import AppKit
import Models

@MainActor
class PopoverViewModel: ObservableObject {
    @Published var isRecording = false
    @Published var isProcessing = false
    @Published var transcribedText = ""
    @Published var recentHistory: [HistoryEntry] = []

    func startRecording(mode: VoiceMode) {
        isRecording = true
        transcribedText = ""
        print("Started recording in \(mode.displayName) mode")
    }

    func stopRecording() {
        isRecording = false
        isProcessing = true
        print("Stopped recording, processing...")
        // Will be connected to services in Phase 7
        Task {
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            transcribedText = "Sample transcription result"
            isProcessing = false
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
