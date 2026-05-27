import SwiftUI
import Utilities
import Models
import Data

struct PopoverView: View {
    @ObservedObject var viewModel: PopoverViewModel
    @State private var selectedMode: VoiceMode = .basic
    @State private var errorState: ErrorBannerState?
    @State private var showPromptLibrary = false

    private var enabledModes: [VoiceMode] {
        VoiceMode.allCases.filter { mode in
            SettingsStore.shared.voiceModeConfigs[mode]?.enabled ?? true
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Mode", selection: $selectedMode) {
                ForEach(enabledModes, id: \.self) { mode in
                    Text(mode.displayName).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.top, 12)

            // Whisper Mode indicator
            if SettingsStore.shared.whisperModeEnabled {
                HStack(spacing: 4) {
                    Image(systemName: "waveform.badge.mic")
                        .font(.caption2)
                    Text("Whisper Mode")
                        .font(.caption2)
                }
                .foregroundColor(.purple)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(
                    Capsule()
                        .fill(Color.purple.opacity(0.12))
                )
                .padding(.top, 4)
            }

            HStack {
                Spacer()
                Button(action: { showPromptLibrary = true }) {
                    Label("Prompt Library", systemImage: "text.book.closed")
                }
                .buttonStyle(.borderless)
                .font(.caption)
                Spacer()
            }
            .padding(.top, 8)

            RecordingControlsView(
                isRecording: $viewModel.isRecording,
                isProcessing: $viewModel.isProcessing,
                currentMode: $selectedMode,
                onStartRecording: { viewModel.startRecording(mode: selectedMode) },
                onStopRecording: { viewModel.stopRecording() },
                onCancelProcessing: { viewModel.cancelProcessing() }
            )

            // Language indicator
            if let lang = viewModel.detectedLang, !viewModel.isRecording {
                HStack(spacing: 4) {
                    Text(langEmoji(for: lang))
                    Text(langDisplayName(for: lang))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.top, 4)
            }

            // Error banner
            if let error = errorState {
                ErrorBannerView(state: error)
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
                            withAnimation { errorState = nil }
                        }
                    }
            }

            Divider()
                .padding(.vertical, 8)

            TranscriptionResultView(
                liveText: viewModel.liveText,
                finalText: viewModel.transcribedText,
                isRecording: viewModel.isRecording,
                isProcessing: viewModel.isProcessing
            )

            if viewModel.showQuickAnswerActions && !viewModel.quickAnswerText.isEmpty {
                QuickAnswerView(
                    answerText: viewModel.quickAnswerText,
                    onInsert: { viewModel.insertQuickAnswer() },
                    onCopy: { viewModel.copyQuickAnswer() }
                )
            }

            if let command = viewModel.detectedEditCommand {
                Text(command.displayLabel)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
                    .padding(.top, 4)
            }

            if viewModel.canSaveStyleExample && !viewModel.didSaveStyleExample {
                Button(action: { viewModel.saveAsStyleExample() }) {
                    Label("Save as Style Example", systemImage: "text.badge.star")
                }
                .buttonStyle(.borderless)
                .font(.caption)
                .padding(.horizontal)
                .padding(.top, 4)
            }

            Divider()
                .padding(.vertical, 8)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Recent")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Button("History") {
                        viewModel.openHistory()
                    }
                    .buttonStyle(.plain)
                    .font(.caption)
                }

                if viewModel.recentHistory.isEmpty {
                    Text("No recent transcriptions")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    ForEach(viewModel.recentHistory.prefix(3), id: \.id) { entry in
                        Button(action: { viewModel.copyToClipboard(entry.processedText) }) {
                            HStack {
                                Text(entry.processedText)
                                    .lineLimit(1)
                                    .font(.caption)
                                    .foregroundColor(.primary)
                                Spacer()
                                Text(entry.createdAt, style: .relative)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal)

            HStack {
                Spacer()
                Button(action: { viewModel.openSettings() }) {
                    Image(systemName: "gear")
                }
                .buttonStyle(.plain)
            }
            .padding(8)
        }
        .frame(width: Constants.UI.popoverWidth, height: Constants.UI.popoverHeight)
        .onReceive(NotificationCenter.default.publisher(for: .transcriptionError)) { notification in
            if let message = notification.userInfo?["message"] as? String {
                errorState = ErrorBannerState(title: "操作失败", message: message)
            }
        }
        .sheet(isPresented: $showPromptLibrary) {
            PromptLibraryView(isPresented: $showPromptLibrary) { preset in
                viewModel.applyPromptPreset(preset)
            }
        }
    }

    private func langEmoji(for code: String) -> String {
        switch code.prefix(2) {
        case "zh": return "🇨🇳"
        case "en": return "🇺🇸"
        case "ja": return "🇯🇵"
        case "ko": return "🇰🇷"
        case "fr": return "🇫🇷"
        case "de": return "🇩🇪"
        case "es": return "🇪🇸"
        case "pt": return "🇵🇹"
        default: return "🌐"
        }
    }

    private func langDisplayName(for code: String) -> String {
        Locale.current.localizedString(forIdentifier: code) ?? code
    }
}
