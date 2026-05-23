import SwiftUI
import AppKit
import Data
import Models
import Services
import Utilities

// MARK: - OnboardingStep

enum OnboardingStep: Int, CaseIterable {
    case welcome = 0
    case permissions = 1
    case transcription = 2
    case aiProvider = 3
    case ready = 4

    var title: String {
        switch self {
        case .welcome: return "Welcome to OpenType"
        case .permissions: return "Permissions"
        case .transcription: return "Transcription Provider"
        case .aiProvider: return "AI Post-Processing"
        case .ready: return "You're All Set!"
        }
    }

    var subtitle: String {
        switch self {
        case .welcome: return "AI-Powered Voice-to-Text for macOS"
        case .permissions: return "OpenType needs a few permissions to work properly"
        case .transcription: return "Choose how your voice gets turned into text"
        case .aiProvider: return "Optionally polish your text with AI (can be skipped)"
        case .ready: return "Start speaking — your words will appear anywhere"
        }
    }
}

// MARK: - PermissionItem

struct PermissionItem: Identifiable {
    let id = UUID()
    let name: String
    let icon: String
    let description: String
    var status: PermissionStatus

    var isGranted: Bool { status == .granted }
}

// MARK: - OnboardingView

struct OnboardingView: View {
    @State private var currentStep: OnboardingStep = .welcome
    @State private var direction: Int = 1 // 1 = forward, -1 = backward

    // Permissions state
    @State private var micPermission = PermissionService.shared.checkMicrophonePermission()
    @State private var speechPermission = PermissionService.shared.checkSpeechPermission()
    @State private var accessibilityGranted = PermissionService.shared.checkAccessibilityPermission()

    // Provider selections
    @State private var selectedTranscription: String = SettingsStore.shared.selectedTranscriptionProvider
    @State private var selectedAI: String = SettingsStore.shared.selectedAIProvider

    // Callback
    var onComplete: () -> Void = {}

    var body: some View {
        VStack(spacing: 0) {
            // Step indicator
            stepIndicator
                .padding(.top, 24)
                .padding(.bottom, 8)

            // Content area with transition
            Group {
                switch currentStep {
                case .welcome:      welcomeStep
                case .permissions:  permissionsStep
                case .transcription: transcriptionStep
                case .aiProvider:   aiProviderStep
                case .ready:        readyStep
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .transition(.asymmetric(
                insertion: .move(edge: direction > 0 ? .trailing : .leading).combined(with: .opacity),
                removal: .move(edge: direction > 0 ? .leading : .trailing).combined(with: .opacity)
            ))
            .animation(.easeInOut(duration: 0.3), value: currentStep)

            // Navigation bar
            navigationBar
                .padding(.horizontal, 32)
                .padding(.bottom, 24)
        }
        .frame(
            width: Constants.UI.onboardingWindowWidth,
            height: Constants.UI.onboardingWindowHeight
        )
    }

    // MARK: - Step Indicator

    private var stepIndicator: some View {
        HStack(spacing: 8) {
            ForEach(OnboardingStep.allCases, id: \.rawValue) { step in
                Circle()
                    .fill(step.rawValue <= currentStep.rawValue ? Color.accentColor : Color.gray.opacity(0.3))
                    .frame(width: step == currentStep ? 10 : 7, height: step == currentStep ? 10 : 7)
                    .animation(.spring(response: 0.3), value: currentStep)
            }
        }
    }

    // MARK: - Welcome Step

    private var welcomeStep: some View {
        VStack(spacing: 20) {
            Spacer()

            if let appIcon = NSImage(named: NSImage.applicationIconName) {
                Image(nsImage: appIcon)
                    .resizable()
                    .frame(width: 96, height: 96)
                    .shadow(color: .black.opacity(0.15), radius: 12, y: 4)
            } else {
                Image(systemName: "mic.badge.plus")
                    .font(.system(size: 72))
                    .foregroundColor(.accentColor)
            }

            VStack(spacing: 8) {
                Text("OpenType")
                    .font(.system(size: 32, weight: .bold, design: .rounded))

                Text("AI-Powered Voice-to-Text")
                    .font(.title3)
                    .foregroundColor(.secondary)

                Text("Type with your voice. Anywhere. Anytime.")
                    .font(.body)
                    .foregroundColor(.secondary.opacity(0.8))
            }

            Spacer()

            // Feature highlights
            HStack(spacing: 24) {
                featureBadge(icon: "mic.fill", text: "Voice Input")
                featureBadge(icon: "wand.and.stars", text: "AI Polish")
                featureBadge(icon: "globe", text: "100+ Languages")
                featureBadge(icon: "lock.shield", text: "Privacy First")
            }
            .padding(.bottom, 16)

            Spacer()
        }
        .padding(.horizontal, 32)
    }

    private func featureBadge(icon: String, text: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.accentColor)
            Text(text)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(width: 80)
    }

    // MARK: - Permissions Step

    private var permissionsStep: some View {
        VStack(spacing: 16) {
            Spacer()

            VStack(alignment: .leading, spacing: 16) {
                permissionRow(
                    name: "Microphone",
                    icon: "mic.fill",
                    description: "Required to record your voice for transcription",
                    status: micPermission,
                    action: requestMicrophone
                )

                Divider()

                permissionRow(
                    name: "Speech Recognition",
                    icon: "waveform",
                    description: "Required for on-device voice transcription",
                    status: speechPermission,
                    action: requestSpeech
                )

                Divider()

                permissionRow(
                    name: "Accessibility",
                    icon: "accessibility",
                    description: "Required for global hotkeys and text insertion",
                    status: accessibilityGranted ? .granted : .denied,
                    action: requestAccessibility
                )
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(nsColor: .controlBackgroundColor))
            )

            if !allPermissionsGranted {
                HStack(spacing: 6) {
                    Image(systemName: "info.circle")
                        .foregroundColor(.orange)
                    Text("You can grant permissions later in System Settings")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 32)
    }

    private var allPermissionsGranted: Bool {
        micPermission == .granted &&
        speechPermission == .granted &&
        accessibilityGranted
    }

    @ViewBuilder
    private func permissionRow(name: String, icon: String, description: String,
                                 status: PermissionStatus, action: @escaping () -> Void) -> some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .frame(width: 32)
                .foregroundColor(.accentColor)

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.headline)
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            switch status {
            case .granted:
                Label("Granted", systemImage: "checkmark.circle.fill")
                    .foregroundColor(.green)
                    .font(.callout)
            case .denied:
                Button("Open Settings") { action() }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            case .notDetermined:
                Button("Grant Access") { action() }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
            }
        }
    }

    // MARK: - Transcription Step

    private var transcriptionStep: some View {
        VStack(spacing: 16) {
            Spacer()

            VStack(spacing: 12) {
                providerCard(
                    id: "Apple Speech",
                    name: "Apple Speech",
                    icon: "applelogo",
                    description: "On-device, offline. No internet required. Best for privacy.",
                    badges: ["Free", "Offline", "Private"]
                )

                providerCard(
                    id: "OpenAI Whisper",
                    name: "OpenAI Whisper",
                    icon: "cloud",
                    description: "Cloud-based. High accuracy across languages. Requires API key.",
                    badges: ["Accurate", "Cloud"]
                )

                providerCard(
                    id: "Groq",
                    name: "Groq",
                    icon: "bolt.fill",
                    description: "Ultra-fast Whisper inference. Requires Groq API key.",
                    badges: ["Fast", "Cloud"]
                )
            }

            Spacer()
        }
        .padding(.horizontal, 32)
        .onAppear {
            if selectedTranscription.isEmpty { selectedTranscription = "Apple Speech" }
        }
    }

    private func providerCard(id: String, name: String, icon: String,
                               description: String, badges: [String]) -> some View {
        let isSelected = selectedTranscription == id

        return Button(action: { selectedTranscription = id }) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.title2)
                    .frame(width: 32)
                    .foregroundColor(isSelected ? .white : .accentColor)

                VStack(alignment: .leading, spacing: 4) {
                    Text(name)
                        .font(.headline)
                        .foregroundColor(isSelected ? .white : .primary)
                    Text(description)
                        .font(.caption)
                        .foregroundColor(isSelected ? .white.opacity(0.85) : .secondary)
                        .lineLimit(2)
                }

                Spacer()

                HStack(spacing: 4) {
                    ForEach(badges, id: \.self) { badge in
                        Text(badge)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(isSelected ? Color.white.opacity(0.2) : Color.gray.opacity(0.15))
                            )
                            .foregroundColor(isSelected ? .white : .secondary)
                    }
                }

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.white)
                }
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Color.accentColor : Color(nsColor: .controlBackgroundColor))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? Color.accentColor : Color.gray.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - AI Provider Step

    private var aiProviderStep: some View {
        VStack(spacing: 16) {
            Spacer()

            Text("AI post-processing polishes your transcribed text — removing filler words, fixing grammar, and adapting tone to each app.")
                .font(.callout)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                aiProviderButton("OpenAI", icon: "brain.head.profile")
                aiProviderButton("Anthropic", icon: "sparkles")
                aiProviderButton("DeepSeek", icon: "magnifyingglass.circle")
                aiProviderButton("Zhipu", icon: "globe.asia.australia")
                aiProviderButton("MiniMax", icon: "waveform.badge.mic")
                aiProviderButton("Moonshot", icon: "moon.stars")
                aiProviderButton("Groq", icon: "bolt.fill")
            }

            Text("You'll need to add your API key in Settings after setup.")
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()
        }
        .padding(.horizontal, 32)
    }

    private func aiProviderButton(_ name: String, icon: String) -> some View {
        let isSelected = selectedAI == name
        return Button(action: { selectedAI = name }) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.body)
                Text(name)
                    .font(.callout)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? Color.accentColor : Color(nsColor: .controlBackgroundColor))
            )
            .foregroundColor(isSelected ? .white : .primary)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.accentColor : Color.gray.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Ready Step

    private var readyStep: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64))
                .foregroundColor(.green)
                .shadow(color: .green.opacity(0.3), radius: 12)

            VStack(spacing: 6) {
                Text("Ready to Go!")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                Text("Here are your shortcuts:")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Hotkey reference
            VStack(spacing: 8) {
                hotkeyRow("Basic Voice Input", "⌘⇧D", "Hold to speak, release to send")
                Divider()
                hotkeyRow("Hands-Free", "⌘⇧Space", "Toggle continuous recording")
                Divider()
                hotkeyRow("Translate", "⌘⇧T", "Speak → English output")
                Divider()
                hotkeyRow("Edit Selected", "⌘⇧E", "Edit text with voice commands")
                Divider()
                hotkeyRow("Quick Answer", "⌘⇧Q", "Ask AI via voice")
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(nsColor: .controlBackgroundColor))
            )
            .padding(.horizontal, 8)

            Spacer()
        }
        .padding(.horizontal, 32)
    }

    private func hotkeyRow(_ name: String, _ shortcut: String, _ desc: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text(name)
                    .font(.callout.bold())
                Text(desc)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text(shortcut)
                .font(.callout.monospaced())
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color(nsColor: .textBackgroundColor))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                )
        }
    }

    // MARK: - Navigation Bar

    private var navigationBar: some View {
        HStack {
            if currentStep != .welcome {
                Button("Back") {
                    direction = -1
                    withAnimation {
                        currentStep = OnboardingStep(rawValue: currentStep.rawValue - 1) ?? .welcome
                    }
                }
                .buttonStyle(.bordered)
            } else {
                Button("Skip Setup") {
                    finishOnboarding()
                }
                .buttonStyle(.plain)
                .foregroundColor(.secondary)
            }

            Spacer()

            if currentStep == .ready {
                Button("Get Started") {
                    finishOnboarding()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .keyboardShortcut(.defaultAction)
            } else if currentStep == .aiProvider {
                HStack(spacing: 8) {
                    Button("Skip") {
                        direction = 1
                        withAnimation {
                            currentStep = .ready
                        }
                    }
                    .buttonStyle(.bordered)

                    Button("Continue") {
                        saveProviderSettings()
                        direction = 1
                        withAnimation {
                            currentStep = .ready
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
                }
            } else {
                Button("Continue") {
                    if currentStep == .transcription {
                        saveProviderSettings()
                    }
                    direction = 1
                    withAnimation {
                        currentStep = OnboardingStep(rawValue: currentStep.rawValue + 1) ?? .ready
                    }
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            }
        }
    }

    // MARK: - Actions

    private func requestMicrophone() {
        Task {
            let status = await PermissionService.shared.requestMicrophonePermission()
            await MainActor.run {
                micPermission = status
            }
        }
    }

    private func requestSpeech() {
        Task {
            let status = await PermissionService.shared.requestSpeechPermission()
            await MainActor.run {
                speechPermission = status
            }
        }
    }

    private func requestAccessibility() {
        PermissionService.shared.requestAccessibilityPermission()
        // Check after a short delay since the system dialog is async
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            accessibilityGranted = PermissionService.shared.checkAccessibilityPermission()
        }
        // Also open System Settings
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
    }

    private func saveProviderSettings() {
        SettingsStore.shared.selectedTranscriptionProvider = selectedTranscription
        SettingsStore.shared.selectedAIProvider = selectedAI
    }

    private func finishOnboarding() {
        saveProviderSettings()
        SettingsStore.shared.hasCompletedOnboarding = true
        onComplete()
    }
}
