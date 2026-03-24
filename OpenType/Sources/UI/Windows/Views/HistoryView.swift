import SwiftUI
import AppKit
import AVFoundation
import Models
import Data
import Utilities

struct HistoryView: View {
    @State private var history: [HistoryEntry] = []
    @State private var selectedEntry: HistoryEntry?
    @State private var audioPlayer: AVAudioPlayer?

    var body: some View {
        HSplitView {
            // Left: History list
            VStack(spacing: 0) {
                // Toolbar
                HStack {
                    Text("\(history.count) items")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    Button(action: refreshHistory) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.borderless)
                    .help("Refresh")

                    Button(action: deleteSelected) {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.borderless)
                    .disabled(selectedEntry == nil)
                    .help("Delete selected")
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(NSColor.windowBackgroundColor))

                Divider()

                if history.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "clock")
                            .font(.system(size: 40))
                            .foregroundColor(.secondary)
                        Text("No history yet")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        Text("Your transcriptions will appear here")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(selection: Binding(
                        get: { selectedEntry?.id },
                        set: { newId in
                            selectedEntry = history.first { $0.id == newId }
                        }
                    )) {
                        ForEach(history) { entry in
                            HistoryRowView(entry: entry)
                                .tag(entry.id)
                        }
                    }
                    .listStyle(.sidebar)
                }
            }
            .frame(minWidth: 200, maxWidth: 280)

            // Right: Detail panel
            if let entry = selectedEntry {
                HistoryDetailPanel(entry: entry, audioPlayer: $audioPlayer)
                    .frame(minWidth: 300)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "text.alignleft")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text("Select an entry to view details")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear { refreshHistory() }
    }

    private func refreshHistory() {
        history = HistoryStore.shared.getAllHistory()
    }

    private func deleteSelected() {
        guard let entry = selectedEntry else { return }
        do {
            try HistoryStore.shared.deleteHistoryEntry(id: entry.id)
            selectedEntry = nil
            refreshHistory()
        } catch {
            print("Failed to delete history entry: \(error)")
        }
    }
}

struct HistoryRowView: View {
    let entry: HistoryEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(entry.mode.displayName)
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.accentColor.opacity(0.2))
                    .cornerRadius(4)

                Spacer()

                Text(entry.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Text(entry.processedText.isEmpty ? entry.originalText : entry.processedText)
                .font(.subheadline)
                .lineLimit(2)
                .foregroundColor(.primary)

            HStack(spacing: 8) {
                Label(formatDuration(entry.duration), systemImage: "clock")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Label(entry.provider, systemImage: "waveform")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

struct HistoryDetailPanel: View {
    let entry: HistoryEntry
    @Binding var audioPlayer: AVAudioPlayer?
    @State private var isPlaying = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.mode.displayName)
                            .font(.headline)
                        Text(entry.createdAt, style: .date)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Text(entry.language)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.secondary.opacity(0.2))
                        .cornerRadius(4)
                }

                Divider()

                // Audio playback
                HStack(spacing: 12) {
                    Button(action: playAudio) {
                        Label(isPlaying ? "Stop" : "Play", systemImage: isPlaying ? "stop.fill" : "play.fill")
                    }
                    .buttonStyle(.borderedProminent)

                    Text("Audio (\(formatDuration(entry.duration)))")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    Text(entry.provider)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Divider()

                // Original text
                if !entry.originalText.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Original")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(entry.originalText)
                            .font(.body)
                    }
                }

                // Processed text
                if !entry.processedText.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Processed")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(entry.processedText)
                            .font(.body)
                    }
                }

                // Copy buttons
                HStack(spacing: 8) {
                    if !entry.originalText.isEmpty {
                        Button("Copy Original") { copyText(entry.originalText) }
                            .buttonStyle(.bordered)
                    }
                    if !entry.processedText.isEmpty {
                        Button("Copy Processed") { copyText(entry.processedText) }
                            .buttonStyle(.bordered)
                    }
                }

                Spacer()
            }
            .padding()
        }
    }

    private func playAudio() {
        if isPlaying {
            audioPlayer?.stop()
            audioPlayer = nil
            isPlaying = false
            return
        }

        let url = getAudioURL()
        guard FileManager.default.fileExists(atPath: url.path) else {
            print("Audio file not found: \(url.path)")
            return
        }

        do {
            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.play()
            isPlaying = true

            // Stop after duration
            DispatchQueue.main.asyncAfter(deadline: .now() + entry.duration) {
                audioPlayer?.stop()
                audioPlayer = nil
                isPlaying = false
            }
        } catch {
            print("Failed to play audio: \(error)")
        }
    }

    private func copyText(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private func getAudioURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent(Constants.appBundleIdentifier)
        if entry.audioPath.hasPrefix("/") {
            return URL(fileURLWithPath: entry.audioPath)
        }
        return base.appendingPathComponent(entry.audioPath)
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
