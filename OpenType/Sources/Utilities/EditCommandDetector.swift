import Foundation
import Models

public enum EditCommandDetector {
    public static func detect(from voiceText: String) -> EditCommand {
        let lower = voiceText.lowercased()

        if lower.contains("translate to") {
            let lang = extractLanguage(from: voiceText)
            return .translate(to: lang)
        }
        if lower.contains("summarize") || lower.contains("give me a summary") {
            return .summarize
        }
        if lower.contains("explain") || lower.contains("what does this mean") {
            return .explain
        }
        if lower.contains("fix grammar") || lower == "correct" {
            return .fixGrammar
        }
        if lower.contains("make formal") || lower.contains("make casual") || lower.contains("make professional") {
            let preset = detectTonePreset(from: lower)
            return .changeTone(preset)
        }
        if lower.contains("rephrase") || lower.contains("rewrite") || lower.contains("reword") {
            return .rephrase
        }
        if lower.contains("shorten") || lower.contains("make shorter") || lower.contains("condense") {
            return .shorten
        }
        if lower.contains("lengthen") || lower.contains("expand") || lower.contains("elaborate") || lower.contains("make longer") {
            return .lengthen
        }

        return .custom
    }

    private static func extractLanguage(from text: String) -> String? {
        guard let range = text.lowercased().range(of: "translate to") else { return nil }
        let after = text[range.upperBound...].trimmingCharacters(in: .whitespaces)
        return after.isEmpty ? nil : String(after)
    }

    private static func detectTonePreset(from text: String) -> TonePreset? {
        if text.contains("formal") || text.contains("professional") { return .professional }
        if text.contains("casual") { return .casual }
        return nil
    }
}
