import Services
import SwiftUI

struct AudioLevelIndicator: View {
    @ObservedObject var audioService: AudioCaptureService
    let isRecording: Bool

    var body: some View {
        ZStack {
            // Outer ring that pulses with audio level
            Circle()
                .stroke(isRecording ? Color.red : Color.accentColor, lineWidth: 3)
                .scaleEffect(isRecording ? 1.0 + CGFloat(audioService.audioLevel) * 0.4 : 1.0)
                .opacity(isRecording ? 0.3 + Double(audioService.audioLevel) * 0.7 : 0.0)
                .frame(width: 80, height: 80)

            // Inner circle (the main button)
            Circle()
                .fill(isRecording ? Color.red : Color.accentColor)
                .frame(width: 64, height: 64)

            // Stop/record icon
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
        .animation(.easeOut(duration: 0.05), value: audioService.audioLevel)
        .animation(.easeInOut(duration: 0.2), value: isRecording)
    }
}
