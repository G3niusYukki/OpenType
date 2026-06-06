import Data
import Models
import Services
import SwiftUI
import Utilities

// MARK: - View Model

private class StyleSettingsViewModel: ObservableObject {
    @Published var profiles: [StyleProfile] = []
    @Published var selectedProfileID: UUID?
    @Published var toneRules: [ToneRule] = []
    @Published var appToneRules: [AppToneRule] = []
    @Published var styleExamples: [StyleExample] = []

    @Published var newProfileName = ""
    @Published var showAddTone = false
    @Published var selectedTonePreset: TonePreset = .professional

    @Published var showAddAppTone = false
    @Published var newAppName = ""
    @Published var newBundleID = ""
    @Published var appTonePreset: TonePreset = .professional
    @Published var useCustomAppTone = false
    @Published var customAppToneDescription = ""
    @Published var customAppToneInstructions = ""

    @Published var showDeleteProfileConfirmation = false

    private let service = StyleProfileService.shared
    private let store = HistoryStore.shared

    var selectedProfile: StyleProfile? {
        profiles.first { $0.id == selectedProfileID }
    }

    func load() {
        do {
            profiles = try service.getAllStyleProfiles()
            if profiles.isEmpty {
                let defaultProfile = StyleProfile(name: "Default", isActive: true)
                try service.saveStyleProfile(defaultProfile)
                profiles = [defaultProfile]
            }
            if let active = profiles.first(where: { $0.isActive }) {
                selectedProfileID = active.id
            } else if let first = profiles.first {
                selectedProfileID = first.id
            }
            loadProfileData()
        } catch {
            print("Failed to load profiles: \(error)")
        }
    }

    func loadProfileData() {
        guard let profileID = selectedProfileID else {
            toneRules = []
            appToneRules = []
            styleExamples = []
            return
        }
        do {
            toneRules = try store.getToneRules(for: profileID)
            appToneRules = try store.getAppToneRules(for: profileID)
            styleExamples = try store.getStyleExamples(for: profileID)
        } catch {
            print("Failed to load profile data: \(error)")
        }
    }

    func createProfile() {
        guard !newProfileName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let profile = StyleProfile(name: newProfileName.trimmingCharacters(in: .whitespaces), isActive: profiles.isEmpty)
        do {
            try service.saveStyleProfile(profile)
            newProfileName = ""
            load()
        } catch {
            print("Failed to create profile: \(error)")
        }
    }

    func setActiveProfile(_ id: UUID) {
        do {
            try service.setActiveProfile(id)
            load()
        } catch {
            print("Failed to set active profile: \(error)")
        }
    }

    func confirmDeleteProfile() {
        showDeleteProfileConfirmation = true
    }

    func deleteProfile() {
        guard let id = selectedProfileID else { return }
        do {
            try service.deleteStyleProfile(id)
            selectedProfileID = nil
            load()
        } catch {
            print("Failed to delete profile: \(error)")
        }
    }

    func addToneRule() {
        guard let profileID = selectedProfileID else { return }
        let rule = ToneRule(
            description: selectedTonePreset.localizedName,
            instructions: selectedTonePreset.instructions,
            profileID: profileID
        )
        do {
            try service.saveToneRule(rule)
            showAddTone = false
            selectedTonePreset = .professional
            loadProfileData()
        } catch {
            print("Failed to save tone rule: \(error)")
        }
    }

    func deleteToneRule(_ id: UUID) {
        do {
            try service.deleteToneRule(id)
            loadProfileData()
        } catch {
            print("Failed to delete tone rule: \(error)")
        }
    }

    func addAppToneRule() {
        guard let profileID = selectedProfileID else { return }
        let description = useCustomAppTone ? customAppToneDescription : appTonePreset.localizedName
        let instructions = useCustomAppTone ? customAppToneInstructions : appTonePreset.instructions
        let rule = AppToneRule(
            bundleID: newBundleID.trimmingCharacters(in: .whitespaces),
            appName: newAppName.trimmingCharacters(in: .whitespaces),
            toneDescription: description,
            instructions: instructions,
            profileID: profileID
        )
        do {
            try service.saveAppToneRule(rule)
            newAppName = ""
            newBundleID = ""
            customAppToneDescription = ""
            customAppToneInstructions = ""
            useCustomAppTone = false
            appTonePreset = .professional
            showAddAppTone = false
            loadProfileData()
        } catch {
            print("Failed to save app tone rule: \(error)")
        }
    }

    func deleteAppToneRule(_ id: UUID) {
        do {
            try service.deleteAppToneRule(id)
            loadProfileData()
        } catch {
            print("Failed to delete app tone rule: \(error)")
        }
    }

    func deleteStyleExample(_ id: UUID) {
        do {
            try service.deleteStyleExample(id)
            loadProfileData()
        } catch {
            print("Failed to delete style example: \(error)")
        }
    }
}

// MARK: - View

struct StyleSettingsView: View {
    @StateObject private var viewModel = StyleSettingsViewModel()

    var body: some View {
        Form {
            activeProfileSection
            globalToneSection
            appTonesSection
            styleExamplesSection
        }
        .formStyle(.grouped)
        .padding()
        .onAppear { viewModel.load() }
        .alert("Delete Profile?", isPresented: $viewModel.showDeleteProfileConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                viewModel.deleteProfile()
            }
        } message: {
            Text("This will permanently delete the profile and all associated tone rules, app tones, and style examples.")
        }
    }

    // MARK: - Active Style Profile

    private var activeProfileSection: some View {
        Section {
            Picker("Profile", selection: Binding(
                get: { viewModel.selectedProfileID },
                set: { newValue in
                    viewModel.selectedProfileID = newValue
                    if let id = newValue {
                        viewModel.setActiveProfile(id)
                    }
                }
            )) {
                ForEach(viewModel.profiles) { profile in
                    Text(profile.name).tag(profile.id as UUID?)
                }
            }
            .pickerStyle(.segmented)

            HStack {
                TextField("New profile name", text: $viewModel.newProfileName)
                    .textFieldStyle(.roundedBorder)
                Button("Create Profile") {
                    viewModel.createProfile()
                }
                .disabled(viewModel.newProfileName.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            if viewModel.profiles.count > 1 {
                Button("Delete Profile", role: .destructive) {
                    viewModel.confirmDeleteProfile()
                }
            }
        } header: {
            Text("Active Style Profile")
        }
    }

    // MARK: - Global Tone

    private var globalToneSection: some View {
        Section {
            if viewModel.toneRules.isEmpty {
                Text("No tone rules added")
                    .foregroundColor(.secondary)
            } else {
                ForEach(viewModel.toneRules) { rule in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rule.description)
                                .font(.body)
                            Text(rule.instructions)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        }
                        Spacer()
                        Button(action: { viewModel.deleteToneRule(rule.id) }) {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.borderless)
                    }
                }
            }

            if viewModel.showAddTone {
                Picker("Preset", selection: $viewModel.selectedTonePreset) {
                    ForEach(TonePreset.allCases, id: \.self) { preset in
                        Text(preset.localizedName).tag(preset)
                    }
                }
                .pickerStyle(.segmented)

                HStack {
                    Button("Cancel") {
                        viewModel.showAddTone = false
                    }
                    Spacer()
                    Button("Add") {
                        viewModel.addToneRule()
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                Button("Add Tone") {
                    viewModel.showAddTone = true
                }
            }
        } header: {
            Text("Global Tone")
        }
    }

    // MARK: - App Tones

    private var appTonesSection: some View {
        Section {
            if viewModel.appToneRules.isEmpty {
                Text("No app-specific tones added")
                    .foregroundColor(.secondary)
            } else {
                ForEach(viewModel.appToneRules) { rule in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rule.appName)
                                .font(.body)
                            Text(rule.bundleID)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(rule.toneDescription)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Button(action: { viewModel.deleteAppToneRule(rule.id) }) {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.borderless)
                    }
                }
            }

            if viewModel.showAddAppTone {
                TextField("App Name", text: $viewModel.newAppName)
                    .textFieldStyle(.roundedBorder)
                TextField("Bundle ID", text: $viewModel.newBundleID)
                    .textFieldStyle(.roundedBorder)

                Picker("Tone", selection: $viewModel.useCustomAppTone) {
                    Text("Preset").tag(false)
                    Text("Custom").tag(true)
                }
                .pickerStyle(.segmented)

                if viewModel.useCustomAppTone {
                    TextField("Description", text: $viewModel.customAppToneDescription)
                        .textFieldStyle(.roundedBorder)
                    TextField("Instructions", text: $viewModel.customAppToneInstructions, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(2 ... 4)
                } else {
                    Picker("Preset", selection: $viewModel.appTonePreset) {
                        ForEach(TonePreset.allCases, id: \.self) { preset in
                            Text(preset.localizedName).tag(preset)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                HStack {
                    Button("Cancel") {
                        viewModel.showAddAppTone = false
                    }
                    Spacer()
                    Button("Add") {
                        viewModel.addAppToneRule()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(
                        viewModel.newAppName.trimmingCharacters(in: .whitespaces).isEmpty
                            || viewModel.newBundleID.trimmingCharacters(in: .whitespaces).isEmpty
                    )
                }
            } else {
                Button("Add App Tone") {
                    viewModel.showAddAppTone = true
                }
            }
        } header: {
            Text("App Tones")
        }
    }

    // MARK: - Style Examples

    private var styleExamplesSection: some View {
        Section {
            if viewModel.styleExamples.isEmpty {
                Text("No style examples added")
                    .foregroundColor(.secondary)
            } else {
                ForEach(viewModel.styleExamples) { example in
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            if let bundleID = example.appBundleID {
                                Text(bundleID)
                                    .font(.caption)
                                    .foregroundColor(.accentColor)
                            }
                            Text("Raw: \(example.rawText)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                            Text("Polished: \(example.polishedText)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        }
                        Spacer()
                        Button(action: { viewModel.deleteStyleExample(example.id) }) {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.borderless)
                    }
                    .padding(.vertical, 2)
                }
            }
        } header: {
            Text("Style Examples")
        }
    }
}
