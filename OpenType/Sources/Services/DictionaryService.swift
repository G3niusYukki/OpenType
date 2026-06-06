import Data
import Foundation
import Models
import NaturalLanguage

public class DictionaryService {
    public static let shared = DictionaryService()

    private init() {}

    /// 对转写文本应用词典替换
    /// 按 term 长度降序替换，避免部分匹配问题（如 "你好世界" 不会被 "你好" 先替换掉）
    public func applyReplacements(to text: String) -> String {
        let entries = DictionaryStore.shared.getAllEntries()
        guard !entries.isEmpty else { return text }

        var result = text
        let sorted = entries.sorted { $0.term.count > $1.term.count }
        for entry in sorted {
            result = result.replacingOccurrences(
                of: entry.term,
                with: entry.replacement,
                options: [.caseInsensitive, .widthInsensitive]
            )
        }
        return result
    }

    /// 从文本中自动学习新词条 — 使用 NSLinguisticTagger 提取专有名词
    public func learnFromText(_ text: String) {
        let existingEntries = DictionaryStore.shared.getAllEntries()
        let existingTerms = Set(existingEntries.map { $0.term.lowercased() })

        let tagger = NSLinguisticTagger(tagSchemes: [.nameType], options: 0)
        tagger.string = text

        let range = NSRange(location: 0, length: text.utf16.count)
        var detectedTerms: [String: Int] = [:]

        tagger.enumerateTags(in: range, unit: .word, scheme: .nameType, options: [.omitWhitespace]) { tag, tokenRange, _ in
            if tag == .personalName || tag == .placeName || tag == .organizationName {
                let term = (text as NSString).substring(with: tokenRange)
                detectedTerms[term, default: 0] += 1
            }
        }

        for (term, count) in detectedTerms where count >= 2 && !existingTerms.contains(term.lowercased()) {
            try? DictionaryStore.shared.saveEntry(term: term, replacement: term, category: "Auto")
        }
    }

    // MARK: - Import / Export

    /// Import dictionary entries from text content.
    /// Supports formats:
    /// - CSV: `term,replacement` or `term,replacement,category`
    /// - Tab-separated: `term\treplacement` or `term\treplacement\tcategory`
    /// - One word per line: `word` (term = replacement = word)
    @discardableResult
    public func importFromText(_ content: String) -> Int {
        let lines = content.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        let existingEntries = DictionaryStore.shared.getAllEntries()
        var existingTerms = Set(existingEntries.map { $0.term.lowercased() })
        var importCount = 0

        for line in lines {
            // Skip comment lines
            if line.hasPrefix("#") || line.hasPrefix("//") { continue }

            let term: String
            let replacement: String
            let category: String

            if line.contains(",") {
                // CSV format
                let parts = line.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
                guard parts.count >= 2 else {
                    // Single word
                    term = line
                    replacement = line
                    category = "Imported"
                    if existingTerms.contains(term.lowercased()) { continue }
                    try? DictionaryStore.shared.saveEntry(term: term, replacement: replacement, category: category)
                    existingTerms.insert(term.lowercased())
                    importCount += 1
                    continue
                }
                term = parts[0]
                replacement = parts[1]
                category = parts.count >= 3 ? parts[2] : "Imported"
            } else if line.contains("\t") {
                // Tab-separated format
                let parts = line.components(separatedBy: "\t").map { $0.trimmingCharacters(in: .whitespaces) }
                term = parts[0]
                replacement = parts.count >= 2 ? parts[1] : parts[0]
                category = parts.count >= 3 ? parts[2] : "Imported"
            } else {
                // Single word per line
                term = line
                replacement = line
                category = "Imported"
            }

            guard !term.isEmpty else { continue }
            if existingTerms.contains(term.lowercased()) { continue }

            try? DictionaryStore.shared.saveEntry(term: term, replacement: replacement, category: category)
            existingTerms.insert(term.lowercased())
            importCount += 1
        }

        return importCount
    }

    /// Extract likely dictionary terms from a plain-text document.
    /// Returns deduplicated `DictionaryEntry` candidates with category="Imported".
    /// Skips terms already present in the dictionary.
    public func extractTermsFromDocument(at url: URL) throws -> [DictionaryEntry] {
        let content = try String(contentsOf: url, encoding: .utf8)
        let existingTerms = Set(DictionaryStore.shared.getAllEntries().map { $0.term.lowercased() })
        let fileExtension = url.pathExtension.lowercased()
        let candidates: [String]

        if fileExtension == "csv" {
            candidates = extractImportTerms(from: content)
        } else {
            candidates = extractDocumentTerms(from: content)
        }

        var seenTerms: Set<String> = []
        var entries: [DictionaryEntry] = []

        for term in candidates {
            let normalized = term.trimmingCharacters(in: .whitespacesAndNewlines)
            let lowercased = normalized.lowercased()
            guard normalized.count > 1 else { continue }
            guard !commonStopWords.contains(lowercased) else { continue }
            guard !existingTerms.contains(lowercased) else { continue }
            guard !seenTerms.contains(lowercased) else { continue }

            seenTerms.insert(lowercased)
            entries.append(DictionaryEntry(
                id: UUID().uuidString,
                term: normalized,
                replacement: normalized,
                category: "Imported"
            ))
        }

        return entries.sorted { $0.term.localizedCaseInsensitiveCompare($1.term) == .orderedAscending }
    }

    /// Export all dictionary entries as tab-separated text
    public func exportAsText() -> String {
        let entries = DictionaryStore.shared.getAllEntries()
        var lines = ["# OpenType Dictionary Export", "# Format: term\\treplacement\\tcategory", ""]
        for entry in entries {
            lines.append("\(entry.term)\t\(entry.replacement)\t\(entry.category)")
        }
        return lines.joined(separator: "\n")
    }

    // MARK: - Smart Suggestions

    /// Analyze transcription history to find words that are frequently
    /// different between originalText and processedText — these are
    /// likely misrecognized terms the user corrects often.
    public func analyzeSmartSuggestions() -> [SmartSuggestion] {
        let history = HistoryStore.shared.getAllHistory()
        guard !history.isEmpty else { return [] }

        let existingEntries = DictionaryStore.shared.getAllEntries()
        let existingTerms = Set(existingEntries.map { $0.term.lowercased() })

        // Track words that differ between original and processed text
        var mismatchWords: [String: (count: Int, replacement: String, context: String)] = [:]

        for entry in history.prefix(100) { // Analyze last 100 entries
            let originalWords = tokenize(entry.originalText)
            let processedWords = tokenize(entry.processedText)

            // Find words in original that got changed or removed in processed
            let processedSet = Set(processedWords.map { $0.lowercased() })

            for word in originalWords {
                let lower = word.lowercased()
                // Skip very short words and common words
                guard lower.count >= 2, !commonStopWords.contains(lower) else { continue }

                if !processedSet.contains(lower) {
                    // This word was changed — find what it became
                    let replacement = findClosestMatch(for: word, in: processedWords)
                    let context = String(entry.originalText.prefix(60))
                    let key = lower

                    if var existing = mismatchWords[key] {
                        existing.count += 1
                        mismatchWords[key] = existing
                    } else {
                        mismatchWords[key] = (count: 1, replacement: replacement, context: context)
                    }
                }
            }
        }

        // Filter: only suggest words that appear 3+ times and aren't already in dictionary
        let suggestions = mismatchWords
            .filter { $0.value.count >= 3 && !existingTerms.contains($0.key) }
            .map { key, value in
                SmartSuggestion(
                    detectedTerm: key,
                    suggestedReplacement: value.replacement.isEmpty ? key : value.replacement,
                    frequency: value.count,
                    context: value.context
                )
            }
            .sorted { $0.frequency > $1.frequency }

        return Array(suggestions.prefix(20))
    }

    // MARK: - Private Helpers

    private func tokenize(_ text: String) -> [String] {
        var words: [String] = []
        text.enumerateSubstrings(in: text.startIndex..., options: .byWords) { substring, _, _, _ in
            if let word = substring { words.append(word) }
        }
        return words
    }

    private func findClosestMatch(for word: String, in candidates: [String]) -> String {
        let lower = word.lowercased()
        // Find the word in candidates that is most similar (prefix match or edit distance)
        for candidate in candidates {
            let candidateLower = candidate.lowercased()
            if candidateLower.hasPrefix(lower.prefix(2)) || lower.hasPrefix(candidateLower.prefix(2)) {
                return candidate
            }
        }
        return word
    }

    private func extractImportTerms(from content: String) -> [String] {
        let lines = content.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        var terms: [String] = []

        for line in lines {
            if line.hasPrefix("#") || line.hasPrefix("//") { continue }

            if line.contains(",") {
                let parts = line.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
                terms.append(parts.first ?? line)
            } else if line.contains("\t") {
                let parts = line.components(separatedBy: "\t").map { $0.trimmingCharacters(in: .whitespaces) }
                terms.append(parts.first ?? line)
            } else {
                terms.append(line)
            }
        }

        return terms
    }

    private func extractDocumentTerms(from text: String) -> [String] {
        var terms: [String] = []
        let tagger = NSLinguisticTagger(tagSchemes: [.nameType], options: 0)
        tagger.string = text
        let range = NSRange(location: 0, length: text.utf16.count)

        tagger.enumerateTags(in: range, unit: .word, scheme: .nameType, options: [.omitWhitespace]) { tag, tokenRange, _ in
            if tag == .personalName || tag == .placeName || tag == .organizationName {
                terms.append((text as NSString).substring(with: tokenRange))
            }
        }

        var capitalizedCounts: [String: Int] = [:]
        text.enumerateSubstrings(in: text.startIndex..., options: .byWords) { substring, _, _, _ in
            guard let word = substring, let first = word.unicodeScalars.first else { return }
            if CharacterSet.uppercaseLetters.contains(first) {
                capitalizedCounts[word, default: 0] += 1
            }
        }

        for (word, count) in capitalizedCounts where count >= 2 {
            terms.append(word)
        }

        return terms
    }

    private var commonStopWords: Set<String> {
        [
            "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
            "have", "has", "had", "do", "does", "did", "will", "would", "could",
            "should", "may", "might", "can", "shall", "to", "of", "in", "for",
            "on", "with", "at", "by", "from", "as", "into", "about", "it", "its",
            "this", "that", "and", "but", "or", "not", "no", "if", "then",
            "i", "me", "my", "we", "our", "you", "your", "he", "she", "they",
            "的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一",
            "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着",
            "没有", "看", "好", "自己", "这", "他", "她", "它", "吗", "呢", "啊", "嗯",
        ]
    }
}
