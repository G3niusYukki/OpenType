import Foundation
import NaturalLanguage
import Data

public class DictionaryService {
    public static let shared = DictionaryService()

    private init() {}

    /// 对转写文本应用词典替换
    /// 按 term 长度降序替换，避免部分匹配问题（如 "你好世界" 不会被 "你好" 先替换掉）
    public func applyReplacements(to text: String) -> String {
        let entries = HistoryStore.shared.getAllDictionaryEntries()
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
        let existingEntries = HistoryStore.shared.getAllDictionaryEntries()
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
            try? HistoryStore.shared.saveDictionaryEntry(
                term: term,
                replacement: term,
                category: "Auto"
            )
        }
    }
}
