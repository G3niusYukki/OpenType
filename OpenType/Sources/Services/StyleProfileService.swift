import Foundation
import Models
import Data

public class StyleProfileService: @unchecked Sendable {
    public static let shared = StyleProfileService()

    private let store = HistoryStore.shared
    private let charsPerToken = 4
    private let maxInstructionTokens = 500
    private let maxExampleTokens = 800
    private let maxSingleExampleTokens = 300

    private var baseSystemPrompt: String {
        """
Process the following transcribed text:
1. Remove filler words (um, uh, 嗯, 啊)
2. Fix repetitions and self-corrections
3. Auto-format: organize lists, steps, and key points into structured text
4. Preserve the original meaning and tone
"""
    }

    public func buildSystemPrompt(appBundleID: String?) -> String {
        var parts = [baseSystemPrompt]
        var tokenCount = parts.joined(separator: " ").count / charsPerToken

        guard let profile = getActiveProfile() else {
            return parts.joined(separator: " ")
        }

        // Add global tone rules
        let toneRules = (try? store.getToneRules(for: profile.id)) ?? []
        for rule in toneRules {
            let instructionTokens = rule.instructions.count / charsPerToken
            if tokenCount + instructionTokens <= maxInstructionTokens {
                parts.append(rule.instructions)
                tokenCount += instructionTokens
            }
        }

        // Add app-specific tone
        if let bundleID = appBundleID,
           let appTone = (try? store.getAppToneRules(for: profile.id))?.first(where: { $0.bundleID == bundleID }) {
            let appTokens = appTone.instructions.count / charsPerToken
            if tokenCount + appTokens <= maxInstructionTokens {
                parts.append(appTone.instructions)
                tokenCount += appTokens
            }
        }

        // Add style examples (few-shot)
        let examples = (try? store.getStyleExamples(for: profile.id)) ?? []
        let sortedExamples = examples
            .sorted { ($0.appBundleID == appBundleID ? 0 : 1) < ($1.appBundleID == appBundleID ? 0 : 1) }
        var exampleTokens = 0
        var exampleCount = 0
        for example in sortedExamples {
            if exampleCount >= 3 || exampleTokens >= maxExampleTokens { break }
            let exampleText = "Example input: \(example.rawText)\nExample output: \(example.polishedText)"
            let tokens = min(exampleText.count, maxSingleExampleTokens * charsPerToken) / charsPerToken
            if exampleTokens + tokens <= maxExampleTokens {
                let truncated = String(exampleText.prefix(maxSingleExampleTokens * charsPerToken))
                parts.append(truncated)
                exampleTokens += tokens
                exampleCount += 1
            }
        }

        return parts.joined(separator: "\n")
    }

    public func buildTranslationPrompt(from: String, to: String, appBundleID: String?) -> String {
        var parts = ["Translate the following text from \(from) to \(to). Return ONLY the translation."]
        if let profile = getActiveProfile(),
           let bundleID = appBundleID,
           let appTone = (try? store.getAppToneRules(for: profile.id))?.first(where: { $0.bundleID == bundleID }) {
            parts.append(appTone.instructions)
        }
        return parts.joined(separator: " ")
    }

    public func buildEditPrompt(selectedText: String, command: EditCommand, appBundleID: String?) -> String {
        let isChinese = Locale.current.language.languageCode?.identifier == "zh"
        var parts: [String]

        if isChinese {
            parts = ["原始文本：\(selectedText)"]
            parts.append("编辑指令：\(commandDescription(for: command, isChinese: true))")
        } else {
            parts = ["Selected text: \(selectedText)"]
            parts.append("Edit command: \(commandDescription(for: command, isChinese: false))")
        }

        if let profile = getActiveProfile(),
           let bundleID = appBundleID,
           let appTone = (try? store.getAppToneRules(for: profile.id))?.first(where: { $0.bundleID == bundleID }) {
            parts.append(appTone.instructions)
        }

        if case .rephrase = command, let profile = getActiveProfile() {
            let examples = (try? store.getStyleExamples(for: profile.id)) ?? []
            if let example = examples.first {
                parts.append("Style reference — Input: \(example.rawText) Output: \(example.polishedText)")
            }
        }

        if command.isReadOnly {
            parts.append(isChinese ? "返回结果，不要修改原始文本。" : "Return the result. Do NOT modify the original text.")
        } else {
            parts.append(isChinese ? "只返回修改后的文本，不要添加任何解释。" : "Return ONLY the modified text. Do not include explanations.")
        }

        return parts.joined(separator: "\n")
    }

    public func buildQuickAnswerPrompt(appBundleID: String?) -> String {
        var parts = [
            "You are a quick answer assistant. The user asked a question via voice input.",
            "Provide a clear, concise, and accurate answer.",
            "If the question is ambiguous, provide the most likely interpretation.",
            "Keep answers brief unless detail is requested.",
            "Return ONLY the answer text, without prefixes or decorative formatting."
        ]

        if let profile = getActiveProfile(),
           let bundleID = appBundleID,
           let appTone = (try? store.getAppToneRules(for: profile.id))?.first(where: { $0.bundleID == bundleID }) {
            parts.append(appTone.instructions)
        }

        return parts.joined(separator: " ")
    }

    private func commandDescription(for command: EditCommand, isChinese: Bool) -> String {
        switch command {
        case .rephrase: return isChinese ? "改写" : "Rephrase the text in different words while preserving the meaning"
        case .shorten: return isChinese ? "缩短" : "Shorten and condense the text"
        case .lengthen: return isChinese ? "加长" : "Expand and elaborate on the text with more detail"
        case .changeTone(let preset): return isChinese ? "改变语气为\(preset?.localizedName ?? "")" : "Change the tone to \(preset?.localizedName ?? "different style")"
        case .translate(let lang): return isChinese ? "翻译为\(lang ?? "")" : "Translate to \(lang ?? "another language")"
        case .summarize: return isChinese ? "摘要" : "Summarize the text"
        case .explain: return isChinese ? "解释" : "Explain what this text means"
        case .fixGrammar: return isChinese ? "修正语法" : "Fix grammar and spelling errors"
        case .custom: return isChinese ? "编辑" : "Edit according to the instruction"
        }
    }

    // MARK: - Profile CRUD

    private func getActiveProfile() -> StyleProfile? {
        let profiles = (try? store.getAllStyleProfiles()) ?? []
        return profiles.first { $0.isActive }
    }

    public func saveStyleProfile(_ profile: StyleProfile) throws { try store.saveStyleProfile(profile) }
    public func deleteStyleProfile(_ id: UUID) throws { try store.deleteStyleProfile(id) }
    public func getAllStyleProfiles() throws -> [StyleProfile] { try store.getAllStyleProfiles() }

    public func setActiveProfile(_ id: UUID) throws {
        let profiles = try store.getAllStyleProfiles()
        for profile in profiles {
            var updated = profile
            updated.isActive = (profile.id == id)
            updated.updatedAt = Date()
            try store.saveStyleProfile(updated)
        }
    }

    public func saveStyleExample(_ example: StyleExample) throws { try store.saveStyleExample(example) }
    public func deleteStyleExample(_ id: UUID) throws { try store.deleteStyleExample(id) }
    public func saveToneRule(_ rule: ToneRule) throws { try store.saveToneRule(rule) }
    public func deleteToneRule(_ id: UUID) throws { try store.deleteToneRule(id) }
    public func saveAppToneRule(_ rule: AppToneRule) throws { try store.saveAppToneRule(rule) }
    public func deleteAppToneRule(_ id: UUID) throws { try store.deleteAppToneRule(id) }
}
