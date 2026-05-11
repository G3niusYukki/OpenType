import SwiftUI

public struct ErrorBannerState: Identifiable {
    public let id = UUID()
    public let title: String
    public let message: String
    public let retryAction: (() -> Void)?

    public init(title: String, message: String, retryAction: (() -> Void)? = nil) {
        self.title = title
        self.message = message
        self.retryAction = retryAction
    }
}

public struct ErrorBannerView: View {
    let state: ErrorBannerState
    @State private var isVisible = false

    public init(state: ErrorBannerState) {
        self.state = state
    }

    public var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.orange)

            VStack(alignment: .leading, spacing: 2) {
                Text(state.title)
                    .font(.caption.bold())
                    .foregroundColor(.primary)
                Text(state.message)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            Spacer()

            if let retry = state.retryAction {
                Button("Retry", action: retry)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.orange.opacity(0.4), lineWidth: 1)
        )
        .padding(.horizontal, 12)
        .opacity(isVisible ? 1 : 0)
        .animation(.easeIn(duration: 0.2), value: isVisible)
        .onAppear {
            isVisible = true
        }
    }
}
