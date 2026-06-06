import Models
import Services
import SwiftUI

struct RecordingControlsView: View {
    @Binding var isRecording: Bool
    @Binding var isProcessing: Bool
    @Binding var currentMode: VoiceMode
    let onStartRecording: () -> Void
    let onStopRecording: () -> Void
    let onCancelProcessing: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text(currentMode.displayName)
                .font(.headline)
                .foregroundColor(.primary)

            Button(action: {
                if isRecording {
                    onStopRecording()
                } else {
                    onStartRecording()
                }
            }) {
                AudioLevelIndicator(
                    audioService: AudioCaptureService.shared,
                    isRecording: isRecording
                )
            }
            .buttonStyle(.plain)

            Text(isRecording ? "Tap to stop" : "Tap to start")
                .font(.caption)
                .foregroundColor(.secondary)

            if isProcessing {
                Button(action: onCancelProcessing) {
                    Label {
                        Text("Cancel")
                    } icon: {
                        Image(systemName: "xmark.circle.fill")
                    }
                }
                .buttonStyle(.borderless)
            }
        }
        .padding()
    }
}
