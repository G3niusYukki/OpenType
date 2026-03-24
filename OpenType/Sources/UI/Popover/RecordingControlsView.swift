import SwiftUI
import Models

struct RecordingControlsView: View {
    @Binding var isRecording: Bool
    @Binding var currentMode: VoiceMode
    let onStartRecording: () -> Void
    let onStopRecording: () -> Void

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
                ZStack {
                    Circle()
                        .fill(isRecording ? Color.red : Color.accentColor)
                        .frame(width: 64, height: 64)

                    if isRecording {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.white)
                            .frame(width: 20, height: 20)
                    } else {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 24, height: 24)
                    }
                }
            }
            .buttonStyle(.plain)

            Text(isRecording ? "Tap to stop" : "Tap to start")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
