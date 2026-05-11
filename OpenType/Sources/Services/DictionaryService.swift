import Foundation
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
        // 按 term 长度降序排序，长词优先替换
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
}
