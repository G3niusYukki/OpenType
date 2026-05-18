import SwiftUI

struct QuickAnswerView: View {
    let answerText: String
    let onInsert: () -> Void
    let onCopy: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Quick Answer", systemImage: "bubble.left.and.text.bubble.fill")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
            }

            ScrollView {
                Text(answerText)
                    .font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
            .frame(maxHeight: 150)

            HStack {
                Button("Insert") { onInsert() }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                Button("Copy") { onCopy() }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                Spacer()
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}