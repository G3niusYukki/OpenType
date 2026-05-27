import Foundation
import Models
import Data

public class StyleProfileService: @unchecked Sendable {
    public static let shared = StyleProfileService()

    private let store = HistoryStore.shared
    private let charsPerToken = 4
    private let maxInstructionTokens = 800
    private let maxExampleTokens = 1200
    private let maxSingleExampleTokens = 400

    private var baseSystemPrompt: String {
        """
        You are a voice-to-text post-processor. Transform raw speech transcription into polished, natural writing.
        Return ONLY the processed text. No explanations, no prefixes, no markdown code fences.

        ## Core Rules

        1. **Remove filler words**: Delete "um", "uh", "like", "you know", "I mean", "嗯", "啊", "那个", "就是", "然后就是", "怎么说呢" and similar hesitations.

        2. **Remove repetitions**: "the the" → "the", "I think I think" → "I think", "你好你好" → "你好". Only remove true accidental repetitions, not intentional emphasis.

        3. **Detect self-correction**: When the speaker corrects themselves mid-sentence, keep ONLY the corrected version.
           - "I went to the store— I mean the library" → "I went to the library"
           - "Send it to John, no wait, send it to Sarah" → "Send it to Sarah"
           - "用Python写, 不对, 用Go写" → "用Go写"

        4. **Understand intent, not just words**: Rephrase awkward spoken phrasing into natural written text while preserving the speaker's meaning and voice.

        ## Auto-Formatting Rules

        Detect the speaker's structural intent and format accordingly:

        - **Numbered steps**: When the speaker lists sequential actions ("first... then... finally..." / "第一步... 第二步..."), format as a numbered list:
          1. Step one
          2. Step two
          3. Step three

        - **Bullet points**: When listing non-sequential items ("we need X, Y, and Z" / "关于A, B, C"), format as a bulleted list:
          • Item A
          • Item B
          • Item C

        - **Paragraphs**: For narrative or conversational text, use clean paragraphs. Do NOT force list formatting when the speaker is telling a story or making a point.

        - **Short messages**: For chat/messaging context (under ~30 words), keep it as a single clean sentence without formatting.

        ## Important Constraints

        - Preserve the original language. Do not translate.
        - Preserve proper nouns, technical terms, and brand names exactly.
        - Do NOT add information the speaker didn't say.
        - Do NOT remove information the speaker clearly intended.
        - Keep the speaker's personality — don't make casual speech sound corporate.
        - Add basic punctuation where missing (periods, commas, question marks).
        """
    }

    /// Context-aware additions based on the target application
    private func appContextPrompt(for bundleID: String?) -> String? {
        guard let bundleID = bundleID else { return nil }

        // Email apps
        let emailApps = ["com.apple.mail", "com.microsoft.Outlook", "com.google.Chrome", "org.mozilla.firefox",
                         "com.superhuman.electron", "com.readdle.Spark", "com.mailbird.mailbird"]
        if emailApps.contains(bundleID) || bundleID.contains("mail") || bundleID.contains("outlook") {
            return "Context: This text is for an email. Use professional tone, proper paragraph structure, and appropriate greetings/sign-offs if the speaker implies them."
        }

        // Chat/messaging apps
        let chatApps = ["com.apple.iChat", "com.tinyspeck.slackmacgap", "us.zoom.xos",
                        "com.microsoft.teams2", "org.telegram.desktop", "com.discord"]
        if chatApps.contains(bundleID) || bundleID.contains("slack") || bundleID.contains("telegram") || bundleID.contains("discord") || bundleID.contains("wechat") {
            return "Context: This text is for a chat message. Keep it concise and conversational. Avoid overly formal language. Prefer short sentences."
        }

        // Code editors / IDEs
        let codeApps = ["com.microsoft.VSCode", "com.jetbrains.intellij", "com.apple.dt.Xcode",
                        "com.jetbrains.pycharm", "com.sublimetext.4"]
        if codeApps.contains(bundleID) || bundleID.contains("code") || bundleID.contains("jetbrains") {
            return "Context: This text is for a code editor (likely comments, commit messages, or documentation). Preserve technical terms, variable names, and code references exactly. Use concise, technical language."
        }

        // Note-taking apps
        let noteApps = ["com.apple.Notes", "com.evernote.Evernote", "notion.id", "md.obsidian",
                        "com.craftdocs.craftlauncher"]
        if noteApps.contains(bundleID) || bundleID.contains("notes") || bundleID.contains("notion") || bundleID.contains("obsidian") {
            return "Context: This text is for a note-taking app. Use clear structure with headers, lists, and paragraphs as appropriate. Organize information for easy scanning."
        }

        return nil
    }

    public func buildSystemPrompt(appBundleID: String?) -> String {
        var parts = [baseSystemPrompt]
        var tokenCount = parts.joined(separator: " ").count / charsPerToken

        // Add app-context-aware prompt (before user style rules)
        if let appContext = appContextPrompt(for: appBundleID) {
            let contextTokens = appContext.count / charsPerToken
            if tokenCount + contextTokens <= maxInstructionTokens {
                parts.append(appContext)
                tokenCount += contextTokens
            }
        }

        guard let profile = getActiveProfile(forBundleID: appBundleID) else {
            return parts.joined(separator: "\n")
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
        if let profile = getActiveProfile(forBundleID: appBundleID),
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

        if let profile = getActiveProfile(forBundleID: appBundleID),
           let bundleID = appBundleID,
           let appTone = (try? store.getAppToneRules(for: profile.id))?.first(where: { $0.bundleID == bundleID }) {
            parts.append(appTone.instructions)
        }

        if case .rephrase = command, let profile = getActiveProfile(forBundleID: appBundleID) {
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

    public func buildPresetPrompt(selectedText: String, instruction: String, bundleID: String?) -> String {
        var parts = [instruction, "Text:\n\(selectedText)"]

        if let profile = getActiveProfile(forBundleID: bundleID),
           let bundleID,
           let appTone = (try? store.getAppToneRules(for: profile.id))?.first(where: { $0.bundleID == bundleID }) {
            parts.append(appTone.instructions)
        } else if let appContext = appContextPrompt(for: bundleID) {
            parts.append(appContext)
        }

        return parts.joined(separator: "\n\n")
    }

    public func buildQuickAnswerPrompt(appBundleID: String?) -> String {
        var parts = [
            "You are a quick answer assistant. The user asked a question via voice input.",
            "Provide a clear, concise, and accurate answer.",
            "If the question is ambiguous, provide the most likely interpretation.",
            "Keep answers brief unless detail is requested.",
            "Return ONLY the answer text, without prefixes or decorative formatting."
        ]

        if let profile = getActiveProfile(forBundleID: appBundleID),
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

    public func getActiveProfile(forBundleID bundleID: String?) -> StyleProfile? {
        if let bundleID,
           let binding = AppProfileBindingStore.shared.binding(for: bundleID),
           let profile = (try? store.getAllStyleProfiles())?.first(where: { $0.id == binding.profileID }) {
            return profile
        }
        return getActiveProfile()
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
