import SwiftUI

struct TranscriptionResultView: View {
    let liveText: String
    let finalText: String
    let isRecording: Bool
    let isProcessing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(isRecording ? "Listening..." : "Result")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                if isRecording {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                        .opacity(0.7)
                }
                if isProcessing {
                    ProgressView()
                        .scaleEffect(0.5)
                        .frame(width: 16, height: 16)
                }
            }

            if isRecording {
                // 实时转写文字（灰色半透明）
                Text(liveText.isEmpty ? "Speak now..." : liveText)
                    .font(.body)
                    .foregroundColor(liveText.isEmpty ? .secondary : .primary.opacity(0.7))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            } else if !finalText.isEmpty {
                Text(finalText)
                    .font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            } else if !isProcessing {
                Text("Your transcription will appear here...")
                    .foregroundColor(.secondary)
                    .italic()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
        .animation(.easeInOut(duration: 0.2), value: isRecording)
    }
}
