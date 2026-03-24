import SwiftUI
import Data
import Utilities
import Models

struct DictionaryView: View {
    @State private var entries: [DictionaryEntry] = []
    @State private var searchText = ""
    @State private var showAddSheet = false
    @State private var newTerm = ""
    @State private var newReplacement = ""
    @State private var newCategory = ""

    var filteredEntries: [DictionaryEntry] {
        if searchText.isEmpty {
            return entries
        }
        return entries.filter {
            $0.term.localizedCaseInsensitiveContains(searchText) ||
            $0.replacement.localizedCaseInsensitiveContains(searchText) ||
            $0.category.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            HStack {
                Text("\(filteredEntries.count) entries")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Button(action: { showAddSheet = true }) {
                    Label("Add", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)

                Button(action: refreshEntries) {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .help("Refresh")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.windowBackgroundColor))

            Divider()

            // Search
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search terms...", text: $searchText)
                    .textFieldStyle(.plain)
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.borderless)
                }
            }
            .padding(8)
            .background(Color(NSColor.textBackgroundColor))
            .cornerRadius(6)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            if filteredEntries.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "book")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    Text(searchText.isEmpty ? "No dictionary entries" : "No results found")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    if searchText.isEmpty {
                        Text("Add custom terms and replacements")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Button("Add Entry") { showAddSheet = true }
                            .buttonStyle(.borderedProminent)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(filteredEntries) { entry in
                        DictionaryEntryRow(entry: entry, onDelete: {
                            deleteEntry(id: entry.id)
                        })
                    }
                }
                .listStyle(.inset)
            }
        }
        .onAppear { refreshEntries() }
        .sheet(isPresented: $showAddSheet) {
            AddDictionaryEntrySheet(
                term: $newTerm,
                replacement: $newReplacement,
                category: $newCategory,
                onSave: saveEntry,
                onCancel: { showAddSheet = false; clearForm() }
            )
        }
    }

    private func refreshEntries() {
        entries = HistoryStore.shared.getAllDictionaryEntries()
    }

    private func saveEntry() {
        guard !newTerm.isEmpty, !newReplacement.isEmpty else { return }
        do {
            try HistoryStore.shared.saveDictionaryEntry(
                term: newTerm,
                replacement: newReplacement,
                category: newCategory.isEmpty ? "General" : newCategory
            )
            showAddSheet = false
            clearForm()
            refreshEntries()
        } catch {
            print("Failed to save dictionary entry: \(error)")
        }
    }

    private func deleteEntry(id: String) {
        do {
            try HistoryStore.shared.deleteDictionaryEntry(id: id)
            refreshEntries()
        } catch {
            print("Failed to delete dictionary entry: \(error)")
        }
    }

    private func clearForm() {
        newTerm = ""
        newReplacement = ""
        newCategory = ""
    }
}

struct DictionaryEntryRow: View {
    let entry: DictionaryEntry
    let onDelete: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(entry.term)
                        .font(.headline)
                        .foregroundColor(.primary)

                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(entry.replacement)
                        .font(.body)
                        .foregroundColor(.secondary)
                }

                if !entry.category.isEmpty && entry.category != "General" {
                    Text(entry.category)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.accentColor.opacity(0.15))
                        .cornerRadius(4)
                }
            }

            Spacer()

            Button(action: onDelete) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
            .buttonStyle(.borderless)
            .help("Delete")
        }
        .padding(.vertical, 4)
    }
}

struct AddDictionaryEntrySheet: View {
    @Binding var term: String
    @Binding var replacement: String
    @Binding var category: String
    let onSave: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("Add Dictionary Entry")
                .font(.headline)

            Form {
                TextField("Term:", text: $term)
                TextField("Replacement:", text: $replacement)
                TextField("Category (optional):", text: $category)
            }
            .textFieldStyle(.roundedBorder)

            HStack(spacing: 12) {
                Button("Cancel", action: onCancel)
                    .keyboardShortcut(.cancelAction)

                Button("Save", action: onSave)
                    .keyboardShortcut(.defaultAction)
                    .disabled(term.isEmpty || replacement.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 360)
    }
}
