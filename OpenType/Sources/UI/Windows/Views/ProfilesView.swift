import AppKit
import Data
import Models
import Services
import SwiftUI
import UniformTypeIdentifiers
import Utilities

struct ProfilesView: View {
    @State private var profiles: [Profile] = []
    @State private var showNewProfileSheet = false
    @State private var newProfileName = ""
    @State private var newTranscriptionProvider = "Apple Speech"
    @State private var newAIProvider = "OpenAI"
    @State private var styleProfiles: [StyleProfile] = []
    @State private var appBindings: [AppProfileBinding] = []
    @State private var showAddBindingSheet = false

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

                    Section("App Bindings") {
                        AppBindingsSection(
                            bindings: appBindings,
                            styleProfiles: styleProfiles,
                            onDelete: deleteBinding,
                            onAdd: { showAddBindingSheet = true }
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
        .sheet(isPresented: $showAddBindingSheet) {
            AddAppBindingSheet(
                profiles: styleProfiles,
                onSave: saveBinding,
                onCancel: { showAddBindingSheet = false }
            )
        }
    }

    private func refreshProfiles() {
        profiles = ProfileStore.shared.getAllProfiles()
        styleProfiles = (try? StyleProfileService.shared.getAllStyleProfiles()) ?? []
        appBindings = AppProfileBindingStore.shared.getAllBindings()
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

    private func saveBinding(bundleID: String, appName: String, profileID: UUID) {
        _ = AppProfileBindingStore.shared.addBinding(bundleID: bundleID, appName: appName, profileID: profileID)
        showAddBindingSheet = false
        refreshProfiles()
    }

    private func deleteBinding(_ binding: AppProfileBinding) {
        AppProfileBindingStore.shared.deleteBinding(id: binding.id)
        refreshProfiles()
    }

    private func clearForm() {
        newProfileName = ""
        newTranscriptionProvider = "Apple Speech"
        newAIProvider = "OpenAI"
    }
}

struct AppBindingsSection: View {
    let bindings: [AppProfileBinding]
    let styleProfiles: [StyleProfile]
    let onDelete: (AppProfileBinding) -> Void
    let onAdd: () -> Void

    var body: some View {
        if bindings.isEmpty {
            Text("No app bindings")
                .foregroundColor(.secondary)
        } else {
            ForEach(bindings) { binding in
                AppBindingRowView(
                    binding: binding,
                    profileName: profileName(for: binding.profileID),
                    onDelete: { onDelete(binding) }
                )
            }
        }

        Button("Add Binding…", action: onAdd)
            .disabled(styleProfiles.isEmpty)
    }

    private func profileName(for id: UUID) -> String {
        styleProfiles.first { $0.id == id }?.name ?? "Missing Profile"
    }
}

struct AppBindingRowView: View {
    let binding: AppProfileBinding
    let profileName: String
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(nsImage: appIcon(for: binding.bundleID))
                .resizable()
                .frame(width: 24, height: 24)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(binding.appName)
                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(profileName)
                        .fontWeight(.medium)
                }
                Text(binding.bundleID)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: onDelete) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
            .buttonStyle(.borderless)
            .help("Delete binding")
        }
        .padding(.vertical, 4)
    }

    private func appIcon(for bundleID: String) -> NSImage {
        if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) {
            return NSWorkspace.shared.icon(forFile: url.path)
        }
        return NSWorkspace.shared.icon(for: .applicationBundle)
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

    private let transcriptionProviders = ["Apple Speech", "OpenAI Whisper", "Groq", "Alibaba Cloud ASR"]
    private let aiProviders = ["OpenAI", "Groq", "Anthropic", "DeepSeek", "Zhipu", "MiniMax", "Moonshot"]

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

struct AddAppBindingSheet: View {
    let profiles: [StyleProfile]
    let onSave: (String, String, UUID) -> Void
    let onCancel: () -> Void

    @State private var selectedBundleID = ""
    @State private var selectedAppName = ""
    @State private var selectedProfileID: UUID?

    var body: some View {
        VStack(spacing: 16) {
            Text("Add App Binding")
                .font(.headline)

            Form {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(selectedAppName.isEmpty ? "No app selected" : selectedAppName)
                        if !selectedBundleID.isEmpty {
                            Text(selectedBundleID)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    Spacer()
                    Button("Pick App…", action: pickApp)
                }

                Picker("Profile:", selection: Binding(
                    get: { selectedProfileID ?? profiles.first?.id },
                    set: { selectedProfileID = $0 }
                )) {
                    ForEach(profiles) { profile in
                        Text(profile.name).tag(profile.id as UUID?)
                    }
                }
            }

            HStack(spacing: 12) {
                Button("Cancel", action: onCancel)
                    .keyboardShortcut(.cancelAction)

                Button("Save") {
                    guard let profileID = selectedProfileID ?? profiles.first?.id else { return }
                    onSave(selectedBundleID, selectedAppName, profileID)
                }
                .keyboardShortcut(.defaultAction)
                .disabled(selectedBundleID.isEmpty || selectedAppName.isEmpty || profiles.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 420)
        .onAppear {
            selectedProfileID = selectedProfileID ?? profiles.first?.id
        }
    }

    private func pickApp() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseFiles = true
        panel.canChooseDirectories = true
        panel.allowedContentTypes = [.applicationBundle]

        guard panel.runModal() == .OK,
              let url = panel.url,
              let bundle = Bundle(url: url),
              let bundleID = bundle.bundleIdentifier else { return }

        selectedBundleID = bundleID
        selectedAppName = appName(from: bundle, url: url)
    }

    private func appName(from bundle: Bundle, url: URL) -> String {
        if let name = bundle.localizedInfoDictionary?["CFBundleName"] as? String, !name.isEmpty {
            return name
        }
        if let name = bundle.infoDictionary?["CFBundleName"] as? String, !name.isEmpty {
            return name
        }
        return url.deletingPathExtension().lastPathComponent
    }
}
