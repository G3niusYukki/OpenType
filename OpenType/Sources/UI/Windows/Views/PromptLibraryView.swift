import SwiftUI
import Models
import Data

struct PromptLibraryView: View {
    @Binding var isPresented: Bool
    let onSelect: (PromptPreset) -> Void

    @State private var presets: [PromptPreset] = []
    @State private var customPresets: [PromptPreset] = []
    @State private var isManagingCustomPrompts = false
    @State private var editingPreset: PromptPreset?
    @State private var showEditor = false
    @State private var editorName = ""
    @State private var editorIcon = "sparkles"
    @State private var editorInstruction = ""

    private let store = PromptPresetStore.shared
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 3)

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(presets) { preset in
                        presetCard(preset)
                    }
                }
                .padding()

                DisclosureGroup(isExpanded: $isManagingCustomPrompts) {
                    customPromptManagement
                } label: {
                    Text("Manage Custom Prompts")
                        .font(.headline)
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
        }
        .frame(minWidth: 520, minHeight: 560)
        .onAppear(perform: reloadPresets)
        .sheet(isPresented: $showEditor) {
            editorSheet
        }
    }

    private var header: some View {
        HStack {
            Text("Prompt Library")
                .font(.title2)
                .fontWeight(.semibold)
            Spacer()
            Button(action: { isPresented = false }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close Prompt Library")
        }
        .padding()
        .background(Color(NSColor.windowBackgroundColor))
    }

    private func presetCard(_ preset: PromptPreset) -> some View {
        Button {
            onSelect(preset)
            isPresented = false
        } label: {
            VStack(spacing: 10) {
                Image(systemName: preset.icon)
                    .font(.title2)
                    .foregroundColor(.accentColor)
                Text(preset.name)
                    .font(.callout)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, minHeight: 96)
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(NSColor.controlBackgroundColor))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.secondary.opacity(0.15))
            )
        }
        .buttonStyle(.plain)
    }

    private var customPromptManagement: some View {
        VStack(alignment: .leading, spacing: 10) {
            if customPresets.isEmpty {
                Text("No custom prompts yet")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForEach(customPresets) { preset in
                    HStack(spacing: 10) {
                        Image(systemName: preset.icon)
                            .frame(width: 22)
                            .foregroundColor(.accentColor)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(preset.name)
                                .font(.body)
                            Text(preset.instruction)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        }
                        Spacer()
                        Button(action: { beginEditing(preset) }) {
                            Image(systemName: "pencil")
                        }
                        .buttonStyle(.borderless)
                        Button(action: { deletePreset(preset) }) {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.borderless)
                    }
                    .padding(.vertical, 4)
                }
            }

            Button(action: beginAdding) {
                Label("Add Custom Prompt…", systemImage: "plus.circle")
            }
            .padding(.top, 4)
        }
        .padding(.top, 8)
    }

    private var editorSheet: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(editingPreset == nil ? "Add Custom Prompt" : "Edit Custom Prompt")
                .font(.title3)
                .fontWeight(.semibold)

            TextField("Name", text: $editorName)
                .textFieldStyle(.roundedBorder)

            TextField("SF Symbol name", text: $editorIcon)
                .textFieldStyle(.roundedBorder)

            Text("Instruction")
                .font(.caption)
                .foregroundColor(.secondary)
            TextEditor(text: $editorInstruction)
                .frame(minHeight: 140)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.25))
                )

            HStack {
                Button("Cancel") {
                    showEditor = false
                }
                Spacer()
                Button("Save") {
                    saveEditor()
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSaveEditor)
            }
        }
        .padding()
        .frame(width: 420)
    }

    private var canSaveEditor: Bool {
        !editorName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !editorIcon.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !editorInstruction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func reloadPresets() {
        presets = store.getAllPresets()
        customPresets = store.getCustomPresets()
    }

    private func beginAdding() {
        editingPreset = nil
        editorName = ""
        editorIcon = "sparkles"
        editorInstruction = ""
        showEditor = true
    }

    private func beginEditing(_ preset: PromptPreset) {
        editingPreset = preset
        editorName = preset.name
        editorIcon = preset.icon
        editorInstruction = preset.instruction
        showEditor = true
    }

    private func saveEditor() {
        let name = editorName.trimmingCharacters(in: .whitespacesAndNewlines)
        let icon = editorIcon.trimmingCharacters(in: .whitespacesAndNewlines)
        let instruction = editorInstruction.trimmingCharacters(in: .whitespacesAndNewlines)

        if var preset = editingPreset {
            preset.name = name
            preset.icon = icon
            preset.instruction = instruction
            try? store.updateCustomPreset(preset)
        } else {
            _ = store.addCustomPreset(name: name, icon: icon, instruction: instruction)
        }

        showEditor = false
        reloadPresets()
    }

    private func deletePreset(_ preset: PromptPreset) {
        try? store.deleteCustomPreset(id: preset.id)
        reloadPresets()
    }
}
