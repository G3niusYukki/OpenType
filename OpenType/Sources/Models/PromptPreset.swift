import Foundation

public struct PromptPreset: Codable, Identifiable, Hashable, Equatable {
    public let id: UUID
    public var name: String
    public var icon: String
    public var instruction: String
    public var isBuiltIn: Bool
    public var sortOrder: Int

    public init(id: UUID = UUID(), name: String, icon: String, instruction: String, isBuiltIn: Bool = false, sortOrder: Int = 0) {
        self.id = id
        self.name = name
        self.icon = icon
        self.instruction = instruction
        self.isBuiltIn = isBuiltIn
        self.sortOrder = sortOrder
    }
}

public extension PromptPreset {
    /// The 10 built-in presets. IDs MUST be deterministic (UUID(uuidString:)!) so they survive across launches.
    static let builtIns: [PromptPreset] = [
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!, name: "Improve Writing", icon: "wand.and.stars", instruction: "Improve the clarity, flow, and quality of the following text. Keep the original meaning and tone. Return ONLY the improved text, no commentary.", isBuiltIn: true, sortOrder: 0),
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-000000000002")!, name: "Fix Grammar", icon: "checkmark.seal", instruction: "Fix all grammar and spelling errors in the following text. Preserve the original style and meaning. Return ONLY the corrected text.", isBuiltIn: true, sortOrder: 1),
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-000000000003")!, name: "Make Professional", icon: "briefcase", instruction: "Rewrite the following text in a professional, formal tone. Keep the core message. Return ONLY the rewritten text.", isBuiltIn: true, sortOrder: 2),
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-000000000004")!, name: "Make Casual", icon: "bubble.left", instruction: "Rewrite the following text in a casual, friendly tone. Keep the core message. Return ONLY the rewritten text.", isBuiltIn: true, sortOrder: 3),
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-000000000005")!, name: "Make Concise", icon: "scissors", instruction: "Shorten the following text while preserving all essential information. Return ONLY the concise version.", isBuiltIn: true, sortOrder: 4),
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-000000000006")!, name: "Summarize", icon: "text.alignleft", instruction: "Summarize the following text in 2-3 sentences. Return ONLY the summary.", isBuiltIn: true, sortOrder: 5),
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-000000000007")!, name: "Bullet Points", icon: "list.bullet", instruction: "Convert the following text into a clear bulleted list. Preserve all key information. Return ONLY the bullets.", isBuiltIn: true, sortOrder: 6),
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-000000000008")!, name: "Explain Simply", icon: "lightbulb", instruction: "Explain the following text in simple, easy-to-understand language as if to a beginner. Return ONLY the explanation.", isBuiltIn: true, sortOrder: 7),
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-000000000009")!, name: "Translate to English", icon: "globe", instruction: "Translate the following text to natural, fluent English. Return ONLY the translation.", isBuiltIn: true, sortOrder: 8),
        PromptPreset(id: UUID(uuidString: "00000000-0000-0000-0000-00000000000A")!, name: "Translate to Chinese", icon: "character", instruction: "Translate the following text to natural, fluent Chinese (Simplified). Return ONLY the translation.", isBuiltIn: true, sortOrder: 9),
    ]
}
