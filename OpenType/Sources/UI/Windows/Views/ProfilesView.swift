import SwiftUI
import Models
import Data
import Utilities

struct ProfilesView: View {
    @State private var profiles: [Profile] = []
    @State private var showNewProfileSheet = false
    @State private var newProfileName = ""
    @State private var newTranscriptionProvider = "Apple Speech"
    @State private var newAIProvider = "OpenAI"

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            HStack {
                Text("\(profiles.count) profiles")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Button(action: { showNewProfileSheet = true }) {
                    Label("New Profile", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)

                Button(action: refreshProfiles) {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .help("Refresh")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.windowBackgroundColor))

            Divider()

            if profiles.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "person.crop.circle")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text("No profiles")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text("Create profiles to quickly switch between different configurations")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Create Profile") { showNewProfileSheet = true }
                        .buttonStyle(.borderedProminent)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(profiles) { profile in
                        ProfileRowView(
                            profile: profile,
                            onSetDefault: { setDefault(profile: profile) },
                            onDelete: { deleteProfile(profile: profile) }
                        )
                    }
                }
                .listStyle(.inset)
            }
        }
        .onAppear { refreshProfiles() }
        .sheet(isPresented: $showNewProfileSheet) {
            NewProfileSheet(
                name: $newProfileName,
                transcriptionProvider: $newTranscriptionProvider,
                aiProvider: $newAIProvider,
                onSave: saveProfile,
                onCancel: { showNewProfileSheet = false; clearForm() }
            )
        }
    }

    private func refreshProfiles() {
        profiles = ProfileStore.shared.getAllProfiles()
    }

    private func saveProfile() {
        guard !newProfileName.isEmpty else { return }
        ProfileStore.shared.createProfile(
            name: newProfileName,
            transcriptionProvider: newTranscriptionProvider,
            aiProvider: newAIProvider
        )
        showNewProfileSheet = false
        clearForm()
        refreshProfiles()
    }

    private func setDefault(profile: Profile) {
        ProfileStore.shared.setDefaultProfile(id: profile.id)
        refreshProfiles()
    }

    private func deleteProfile(profile: Profile) {
        ProfileStore.shared.deleteProfile(id: profile.id)
        refreshProfiles()
    }

    private func clearForm() {
        newProfileName = ""
        newTranscriptionProvider = "Apple Speech"
        newAIProvider = "OpenAI"
    }
}

struct ProfileRowView: View {
    let profile: Profile
    let onSetDefault: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(profile.name)
                        .font(.headline)

                    if profile.isDefault {
                        Text("Default")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.2))
                            .foregroundColor(.green)
                            .cornerRadius(4)
                    }
                }

                HStack(spacing: 16) {
                    Label(profile.transcriptionProvider, systemImage: "waveform")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Label(profile.aiProvider, systemImage: "brain")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if !profile.isDefault {
                Button("Set Default") { onSetDefault() }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                }
                .buttonStyle(.borderless)
                .help("Delete profile")
            }
        }
        .padding(.vertical, 8)
    }
}

struct NewProfileSheet: View {
    @Binding var name: String
    @Binding var transcriptionProvider: String
    @Binding var aiProvider: String
    let onSave: () -> Void
    let onCancel: () -> Void

    private let transcriptionProviders = ["Apple Speech", "OpenAI Whisper", "Groq", "Alibaba", "Tencent", "Baidu", "iFlytek"]
    private let aiProviders = ["OpenAI", "Anthropic", "DeepSeek", "Zhipu", "MiniMax", "Moonshot", "Groq"]

    var body: some View {
        VStack(spacing: 16) {
            Text("New Profile")
                .font(.headline)

            Form {
                TextField("Profile Name:", text: $name)

                Picker("Transcription:", selection: $transcriptionProvider) {
                    ForEach(transcriptionProviders, id: \.self) { provider in
                        Text(provider).tag(provider)
                    }
                }

                Picker("AI Provider:", selection: $aiProvider) {
                    ForEach(aiProviders, id: \.self) { provider in
                        Text(provider).tag(provider)
                    }
                }
            }
            .textFieldStyle(.roundedBorder)

            HStack(spacing: 12) {
                Button("Cancel", action: onCancel)
                    .keyboardShortcut(.cancelAction)

                Button("Save", action: onSave)
                    .keyboardShortcut(.defaultAction)
                    .disabled(name.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 380)
    }
}
