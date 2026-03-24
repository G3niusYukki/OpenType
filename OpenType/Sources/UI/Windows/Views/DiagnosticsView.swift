import SwiftUI
import Models
import Services
import Utilities

struct DiagnosticsView: View {
    @State private var results: [DiagnosticResult] = []
    @State private var isRunning = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("System Diagnostics")
                    .font(.headline)
                Spacer()
                Button(action: runDiagnostics) {
                    if isRunning {
                        ProgressView()
                            .scaleEffect(0.7)
                    } else {
                        Text("Run Diagnostics")
                    }
                }
                .disabled(isRunning)
            }
            .padding()

            Divider()

            if results.isEmpty && !isRunning {
                VStack {
                    Image(systemName: "stethoscope")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("Click 'Run Diagnostics' to check system health")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(results) { result in
                    DiagnosticRowView(result: result)
                }
                .listStyle(.inset)
            }
        }
        .frame(width: Constants.UI.diagnosticsWindowWidth, height: Constants.UI.diagnosticsWindowHeight)
        .onAppear { if results.isEmpty { runDiagnostics() } }
    }

    private func runDiagnostics() {
        isRunning = true
        results = []
        Task {
            results = await DiagnosticsService.shared.runAllDiagnostics()
            isRunning = false
        }
    }
}

struct DiagnosticRowView: View {
    let result: DiagnosticResult

    var body: some View {
        HStack {
            Image(systemName: iconName(for: result.status))
                .foregroundColor(color(for: result.status))

            VStack(alignment: .leading, spacing: 2) {
                Text(result.name).font(.body)
                Text(result.details).font(.caption).foregroundColor(.secondary)
                if let suggestion = result.suggestion {
                    Text(suggestion).font(.caption).foregroundColor(.orange)
                }
            }
            Spacer()
        }
        .padding(.vertical, 4)
    }

    private func iconName(for status: DiagnosticStatus) -> String {
        switch status {
        case .pass: return "checkmark.circle.fill"
        case .fail: return "xmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .skipped: return "minus.circle.fill"
        }
    }

    private func color(for status: DiagnosticStatus) -> Color {
        switch status {
        case .pass: return .green
        case .fail: return .red
        case .warning: return .orange
        case .skipped: return .gray
        }
    }
}
