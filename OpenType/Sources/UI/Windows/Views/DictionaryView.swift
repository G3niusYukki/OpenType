import SwiftUI
import Data
import Services
import Utilities
import Models
import UniformTypeIdentifiers

struct DictionaryView: View {
    @State private var entries: [DictionaryEntry] = []
    @State private var searchText = ""
    @State private var showAddSheet = false
    @State private var newTerm = ""
    @State private var newReplacement = ""
    @State private var newCategory = ""
    @State private var showImportOptions = false
    @State private var showSmartSuggestions = false
    @State private var smartSuggestions: [SmartSuggestion] = []
    @State private var showDocumentImportPreview = false
    @State private var documentImportCandidates: [DictionaryEntry] = []

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

                // Smart Suggestions
                Button(action: analyzeSmartSuggestions) {
                    Label("Suggestions", systemImage: "lightbulb")
                }
                .buttonStyle(.bordered)
                .help("Detect frequently corrected words")

                // Import menu
                Menu {
                    Button("Import from File...") { importFromFile() }
                    Button("Import from Document...") { importFromDocument() }
                    Button("Import from Clipboard") { importFromClipboard() }
                    Divider()
                    Button("Export to Clipboard") { exportToClipboard() }
                } label: {
                    Label("Import", systemImage: "square.and.arrow.down")
                }
                .menuStyle(.borderlessButton)

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
        .sheet(isPresented: $showSmartSuggestions) {
            SmartSuggestionsSheet(
                suggestions: smartSuggestions,
                onAccept: { suggestion in
                    do {
                        try HistoryStore.shared.saveDictionaryEntry(
                            term: suggestion.detectedTerm,
                            replacement: suggestion.suggestedReplacement,
                            category: "Suggested"
                        )
                        smartSuggestions.removeAll { $0.id == suggestion.id }
                        refreshEntries()
                    } catch {
                        print("Failed to save suggestion: \(error)")
                    }
                },
                onDismiss: { showSmartSuggestions = false }
            )
        }
        .sheet(isPresented: $showDocumentImportPreview) {
            DocumentImportPreviewSheet(
                entries: documentImportCandidates,
                onConfirm: addDocumentImportCandidates,
                onCancel: {
                    showDocumentImportPreview = false
                    documentImportCandidates.removeAll()
                }
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

    // MARK: - Import / Export

    private func importFromFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.plainText, .commaSeparatedText]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.message = "Select a text or CSV file to import dictionary entries"

        if panel.runModal() == .OK, let url = panel.url {
            do {
                let content = try String(contentsOf: url, encoding: .utf8)
                let count = DictionaryService.shared.importFromText(content)
                refreshEntries()
                showImportAlert(title: "Import Complete", message: "Successfully imported \(count) entries.")
            } catch {
                showImportAlert(title: "Import Failed", message: "Could not read file: \(error.localizedDescription)")
            }
        }
    }

    private func importFromDocument() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.plainText, .commaSeparatedText, .text]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.message = "Select a text, Markdown, or CSV file to scan for dictionary terms"

        if panel.runModal() == .OK, let url = panel.url {
            do {
                documentImportCandidates = try DictionaryService.shared.extractTermsFromDocument(at: url)
                showDocumentImportPreview = true
            } catch {
                showImportAlert(title: "Import Failed", message: error.localizedDescription)
            }
        }
    }

    private func addDocumentImportCandidates() {
        for entry in documentImportCandidates {
            try? HistoryStore.shared.saveDictionaryEntry(
                term: entry.term,
                replacement: entry.replacement,
                category: entry.category
            )
        }
        showDocumentImportPreview = false
        documentImportCandidates.removeAll()
        refreshEntries()
    }

    private func importFromClipboard() {
        guard let text = NSPasteboard.general.string(forType: .string) else {
            showImportAlert(title: "Empty Clipboard", message: "No text found in clipboard.")
            return
        }
        let count = DictionaryService.shared.importFromText(text)
        refreshEntries()
        showImportAlert(title: "Import Complete", message: "Successfully imported \(count) entries from clipboard.")
    }

    private func exportToClipboard() {
        let text = DictionaryService.shared.exportAsText()
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        showImportAlert(title: "Exported", message: "\(entries.count) entries copied to clipboard.")
    }

    private func showImportAlert(title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    // MARK: - Smart Suggestions

    private func analyzeSmartSuggestions() {
        let suggestions = DictionaryService.shared.analyzeSmartSuggestions()
        if suggestions.isEmpty {
            showImportAlert(title: "No Suggestions", message: "No frequently corrected words found in your history.")
            return
        }
        smartSuggestions = suggestions
        showSmartSuggestions = true
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

struct DocumentImportPreviewSheet: View {
    let entries: [DictionaryEntry]
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Image(systemName: "doc.text.magnifyingglass")
                    .foregroundColor(.accentColor)
                Text("Import from Document")
                    .font(.headline)
                Spacer()
                Text("\(entries.count) found")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text("Review the likely dictionary terms found in this document before adding them.")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.leading)

            if entries.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 32))
                        .foregroundColor(.secondary)
                    Text("No new terms found")
                        .font(.callout)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, minHeight: 120)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        ForEach(entries) { entry in
                            HStack(spacing: 8) {
                                Text(entry.term)
                                    .font(.body)
                                Image(systemName: "arrow.right")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(entry.replacement)
                                    .font(.body)
                                    .foregroundColor(.secondary)
                                Spacer()
                            }
                            .padding(.vertical, 2)
                        }
                    }
                    .padding(8)
                }
                .frame(maxHeight: 300)
                .background(Color(NSColor.textBackgroundColor))
                .cornerRadius(6)
            }

            HStack(spacing: 12) {
                Spacer()
                Button("Cancel", action: onCancel)
                    .keyboardShortcut(.cancelAction)

                Button("Add \(entries.count) terms", action: onConfirm)
                    .keyboardShortcut(.defaultAction)
                    .disabled(entries.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 480)
    }
}

// MARK: - SmartSuggestionsSheet

struct SmartSuggestionsSheet: View {
    @State var suggestions: [SmartSuggestion]
    let onAccept: (SmartSuggestion) -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Image(systemName: "lightbulb.fill")
                    .foregroundColor(.yellow)
                Text("Smart Suggestions")
                    .font(.headline)
                Spacer()
                Text("\(suggestions.count) found")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text("These words appear frequently in your transcriptions and may benefit from a dictionary entry.")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.leading)

            if suggestions.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 32))
                        .foregroundColor(.green)
                    Text("No suggestions — your dictionary looks good!")
                        .font(.callout)
                }
                .frame(maxHeight: .infinity)
            } else {
                List {
                    ForEach(suggestions) { suggestion in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Text(suggestion.detectedTerm)
                                        .font(.headline)
                                    Image(systemName: "arrow.right")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text(suggestion.suggestedReplacement)
                                        .font(.body)
                                        .foregroundColor(.secondary)
                                }
                                Text(suggestion.context)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }

                            Spacer()

                            HStack(spacing: 4) {
                                Text("\(suggestion.frequency)×")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)

                                Button(action: { onAccept(suggestion) }) {
                                    Image(systemName: "plus.circle.fill")
                                        .foregroundColor(.green)
                                }
                                .buttonStyle(.borderless)
                                .help("Add to dictionary")
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
                .listStyle(.inset)
            }

            HStack {
                Spacer()
                if !suggestions.isEmpty {
                    Button("Accept All") {
                        for s in suggestions { onAccept(s) }
                        suggestions.removeAll()
                    }
                    .buttonStyle(.bordered)
                }
                Button("Close", action: onDismiss)
                    .keyboardShortcut(.cancelAction)
            }
        }
        .padding(24)
        .frame(width: 480, height: 420)
    }
}
