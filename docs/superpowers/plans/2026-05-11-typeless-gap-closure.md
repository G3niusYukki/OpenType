# v0.6.0 Typeless Gap Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the feature gap between OpenType and Typeless on macOS by adding personal style learning, per-app tone adaptation, language auto-detection, and enhanced voice editing.

**Architecture:** Foundation-First — build StyleProfileService (shared prompt-merging infrastructure) first, then stack features on top. The AIProvider protocol changes from hardcoded prompts to external `prompt` parameter. StyleProfileService builds system prompts from tone rules, app tones, and style examples.

**Tech Stack:** Swift 5.9+, macOS 13+, SwiftUI/AppKit, SQLite.swift, SFSpeechRecognizer

---

## File Structure

### New Files

| Path | Responsibility |
|---|---|
| `Sources/Models/StyleProfile.swift` | StyleProfile, StyleExample, ToneRule, AppToneRule, TonePreset types |
| `Sources/Models/EditCommand.swift` | EditCommand enum |
| `Sources/Services/StyleProfileService.swift` | Prompt merging, style profile CRUD, singleton |
| `Sources/Utilities/EditCommandDetector.swift` | Parse voice command into EditCommand |
| `Sources/Providers/Transcription/AppleSpeechAutoDetector.swift` | Parallel multi-locale recognition |

### Modified Files

| Path | Change |
|---|---|
| `Sources/Providers/AI/AIProvider.swift` | Add `prompt` param, remove `removeFillers()` |
| `Sources/Providers/AI/OpenAIProvider.swift` | Use `prompt` as system message, remove hardcoded prompt |
| `Sources/Providers/AI/AnthropicProvider.swift` | Same |
| `Sources/Providers/AI/DeepSeekProvider.swift` | Same |
| `Sources/Providers/AI/GroqAIProvider.swift` | Same |
| `Sources/Providers/AI/ZhipuProvider.swift` | Same |
| `Sources/Providers/AI/MiniMaxProvider.swift` | Same |
| `Sources/Providers/AI/MoonshotProvider.swift` | Same |
| `Sources/Services/AIProcessingService.swift` | Add `processWithPrompt`, `appBundleID`, remove `removeFillers` |
| `Sources/Data/HistoryStore.swift` | Add 4 tables, ALTER TABLE migration, `PRAGMA foreign_keys` |
| `Sources/Data/HistoryEntry.swift` | Add `appBundleID` |
| `Sources/Data/SettingsStore.swift` | Add `recentLocales`, `suggestedAppTones` |
| `Sources/Data/VoiceModeConfig.swift` | Add `autoDetectLanguage`, Codable migration |
| `Sources/UI/Popover/PopoverViewModel.swift` | Pass `appBundleID`, edit command detection, style save |
| `Sources/UI/Popover/PopoverView.swift` | Style example button, edit command label |
| `Sources/Services/TextInsertionService.swift` | Add `insertTextAfterSelection()` |
| `Sources/Providers/Transcription/AppleSpeechProvider.swift` | Auto-detect mode, AppleSpeechAutoDetector |
| `Sources/Providers/Transcription/GroqTranscriptionProvider.swift` | Multilingual model selection, `detectedLanguage` |
| `Sources/Providers/Transcription/OpenAIWhisperProvider.swift` | `detectedLanguage` from API |
| `Sources/Providers/Transcription/AliyunASRProvider.swift` | `detectedLanguage` from API |
| `Sources/Providers/Transcription/TranscriptionProvider.swift` | No change (protocol already has optional `language`) |
| `Sources/UI/Windows/Views/SettingsView.swift` | Add Style tab |
| `Sources/Utilities/Constants.swift` | Add UserDefaults keys |

### Test Files

| Path | Tests |
|---|---|
| `Tests/StyleProfileServiceTests.swift` | Prompt merging, token budget, example selection |
| `Tests/EditCommandDetectorTests.swift` | Command detection from voice input |
| `Tests/HistoryStoreMigrationTests.swift` | ALTER TABLE migration, new table creation |

---

## Task 1: StyleProfile Data Models

**Files:**
- Create: `Sources/Models/StyleProfile.swift`
- Create: `Sources/Models/EditCommand.swift`
- Test: `Tests/StyleProfileServiceTests.swift` (partial — model tests)

- [ ] **Step 1: Create StyleProfile.swift with all data models**

```swift
// Sources/Models/StyleProfile.swift
import Foundation

public struct StyleProfile: Identifiable, Codable, Equatable {
    public let id: UUID
    public var name: String
    public var isActive: Bool
    public let createdAt: Date
    public var updatedAt: Date

    public init(id: UUID = UUID(), name: String, isActive: Bool = false,
                createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.name = name
        self.isActive = isActive
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct StyleExample: Identifiable, Codable, Equatable {
    public let id: UUID
    public let rawText: String
    public let polishedText: String
    public let appBundleID: String?
    public let timestamp: Date
    public let profileID: UUID

    public init(id: UUID = UUID(), rawText: String, polishedText: String,
                appBundleID: String? = nil, timestamp: Date = Date(), profileID: UUID) {
        self.id = id
        self.rawText = rawText
        self.polishedText = polishedText
        self.appBundleID = appBundleID
        self.timestamp = timestamp
        self.profileID = profileID
    }
}

public struct ToneRule: Identifiable, Codable, Equatable {
    public let id: UUID
    public var description: String
    public var instructions: String
    public let profileID: UUID

    public init(id: UUID = UUID(), description: String, instructions: String, profileID: UUID) {
        self.id = id
        self.description = description
        self.instructions = instructions
        self.profileID = profileID
    }
}

public struct AppToneRule: Identifiable, Codable, Equatable {
    public let id: UUID
    public let bundleID: String
    public var appName: String
    public var toneDescription: String
    public var instructions: String
    public let profileID: UUID

    public init(id: UUID = UUID(), bundleID: String, appName: String,
                toneDescription: String, instructions: String, profileID: UUID) {
        self.id = id
        self.bundleID = bundleID
        self.appName = appName
        self.toneDescription = toneDescription
        self.instructions = instructions
        self.profileID = profileID
    }
}

public enum TonePreset: String, Codable, CaseIterable {
    case professional
    case casual
    case concise
    case creative
    case academic

    public var key: String { rawValue }

    public var localizedName: String {
        switch self {
        case .professional: return NSLocalizedString("tone.professional", value: "Professional", comment: "")
        case .casual: return NSLocalizedString("tone.casual", value: "Casual", comment: "")
        case .concise: return NSLocalizedString("tone.concise", value: "Concise", comment: "")
        case .creative: return NSLocalizedString("tone.creative", value: "Creative", comment: "")
        case .academic: return NSLocalizedString("tone.academic", value: "Academic", comment: "")
        }
    }

    public var instructions: String {
        switch self {
        case .professional: return "Write in a formal, professional tone suitable for business communication"
        case .casual: return "Write in a relaxed, conversational tone as if texting a friend"
        case .concise: return "Be brief and direct. Remove unnecessary words"
        case .creative: return "Use vivid, expressive language. Be creative with word choice"
        case .academic: return "Write in a scholarly tone with precise terminology"
        }
    }
}
```

- [ ] **Step 2: Create EditCommand.swift**

```swift
// Sources/Models/EditCommand.swift
import Foundation

public enum EditCommand: Equatable {
    case rephrase
    case shorten
    case lengthen
    case changeTone(TonePreset?)
    case translate(to: String?)
    case summarize
    case explain
    case fixGrammar
    case custom

    public var isReadOnly: Bool {
        switch self {
        case .summarize, .explain, .translate: return true
        default: return false
        }
    }

    public var displayLabel: String {
        switch self {
        case .rephrase: return NSLocalizedString("edit.rephrased", value: "Rephrased", comment: "")
        case .shorten: return NSLocalizedString("edit.shortened", value: "Shortened", comment: "")
        case .lengthen: return NSLocalizedString("edit.lengthened", value: "Lengthened", comment: "")
        case .changeTone: return NSLocalizedString("edit.toneChanged", value: "Tone Changed", comment: "")
        case .translate(let lang): return String(format: NSLocalizedString("edit.translated", value: "Translated to %@", comment: ""), lang ?? "")
        case .summarize: return NSLocalizedString("edit.summarized", value: "Summarized", comment: "")
        case .explain: return NSLocalizedString("edit.explained", value: "Explained", comment: "")
        case .fixGrammar: return NSLocalizedString("edit.grammarFixed", value: "Grammar Fixed", comment: "")
        case .custom: return NSLocalizedString("edit.custom", value: "Edited", comment: "")
        }
    }
}
```

- [ ] **Step 3: Write failing tests for model creation**

```swift
// Tests/StyleProfileServiceTests.swift
import XCTest
@testable import Models

final class StyleProfileServiceTests: XCTestCase {

    // MARK: - Model Tests

    func testStyleProfileCreation() {
        let profile = StyleProfile(name: "Test Style")
        XCTAssertEqual(profile.name, "Test Style")
        XCTAssertFalse(profile.isActive)
    }

    func testStyleExampleCreation() {
        let profileID = UUID()
        let example = StyleExample(rawText: "um hello", polishedText: "hello", profileID: profileID)
        XCTAssertEqual(example.rawText, "um hello")
        XCTAssertEqual(example.polishedText, "hello")
        XCTAssertEqual(example.profileID, profileID)
        XCTAssertNil(example.appBundleID)
    }

    func testTonePresetInstructions() {
        XCTAssertFalse(TonePreset.professional.instructions.isEmpty)
        XCTAssertEqual(TonePreset.allCases.count, 5)
    }

    func testEditCommandReadOnlyClassification() {
        XCTAssertTrue(EditCommand.summarize.isReadOnly)
        XCTAssertTrue(EditCommand.explain.isReadOnly)
        XCTAssertTrue(EditCommand.translate(to: nil).isReadOnly)
        XCTAssertFalse(EditCommand.rephrase.isReadOnly)
        XCTAssertFalse(EditCommand.shorten.isReadOnly)
        XCTAssertFalse(EditCommand.custom.isReadOnly)
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift test --filter StyleProfileServiceTests`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add Sources/Models/StyleProfile.swift Sources/Models/EditCommand.swift Tests/StyleProfileServiceTests.swift
git commit -m "feat: add StyleProfile, EditCommand data models with tests"
```

---

## Task 2: HistoryStore Schema Extension + Migration

**Files:**
- Modify: `Sources/Data/HistoryStore.swift`
- Modify: `Sources/Models/HistoryEntry.swift`
- Test: `Tests/HistoryStoreMigrationTests.swift`

- [ ] **Step 1: Write failing test for new tables**

```swift
// Tests/HistoryStoreMigrationTests.swift
import XCTest
@testable import Data

final class HistoryStoreMigrationTests: XCTestCase {

    func testStyleProfilesTableExists() throws {
        let store = HistoryStore.shared
        let profiles = try store.getAllStyleProfiles()
        XCTAssertEqual(profiles.count, 0)
    }

    func testStyleExamplesTableExists() throws {
        let store = HistoryStore.shared
        let profileID = UUID()
        let examples = try store.getStyleExamples(for: profileID)
        XCTAssertEqual(examples.count, 0)
    }

    func testAppToneRulesTableExists() throws {
        let store = HistoryStore.shared
        let profileID = UUID()
        let rules = try store.getAppToneRules(for: profileID)
        XCTAssertEqual(rules.count, 0)
    }

    func testToneRulesTableExists() throws {
        let store = HistoryStore.shared
        let profileID = UUID()
        let rules = try store.getToneRules(for: profileID)
        XCTAssertEqual(rules.count, 0)
    }

    func testHistoryEntryHasAppBundleID() throws {
        let entry = HistoryEntry(
            audioPath: "/tmp/test.wav",
            originalText: "hello",
            processedText: "hello",
            mode: .basic,
            provider: "Apple Speech",
            duration: 1.0,
            language: "en",
            appBundleID: "com.apple.mail"
        )
        XCTAssertEqual(entry.appBundleID, "com.apple.mail")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift test --filter HistoryStoreMigrationTests`
Expected: FAIL — `getAllStyleProfiles` not defined, `appBundleID` not on HistoryEntry

- [ ] **Step 3: Add `appBundleID` to HistoryEntry**

In `Sources/Models/HistoryEntry.swift`, add `appBundleID: String?` property and update init:

```swift
public let appBundleID: String?

public init(id: UUID = UUID(), audioPath: String, originalText: String,
            processedText: String, mode: VoiceMode, provider: String,
            createdAt: Date = Date(), duration: TimeInterval, language: String,
            appBundleID: String? = nil) {
    // ... existing assignments ...
    self.appBundleID = appBundleID
}
```

- [ ] **Step 4: Add new SQLite tables + migration to HistoryStore**

In `Sources/Data/HistoryStore.swift`:

1. Add `PRAGMA foreign_keys = ON` after opening the database connection
2. Add table definitions for `style_profiles`, `style_examples`, `tone_rules`, `app_tone_rules`
3. Add ALTER TABLE migration for `history.app_bundle_id` column
4. Add CRUD methods: `getAllStyleProfiles()`, `saveStyleProfile()`, `deleteStyleProfile()`, `getStyleExamples(for:)`, `saveStyleExample()`, `deleteStyleExample()`, `getToneRules(for:)`, `saveToneRule()`, `deleteToneRule()`, `getAppToneRules(for:)`, `saveAppToneRule()`, `deleteAppToneRule()`
5. Update `saveHistoryEntry()` to write `appBundleID`
6. Update `getAllHistory()` and `getRecentHistory()` to read `appBundleID`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift test --filter HistoryStoreMigrationTests`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add Sources/Data/HistoryStore.swift Sources/Models/HistoryEntry.swift Tests/HistoryStoreMigrationTests.swift
git commit -m "feat: add style profile SQLite tables, history migration, appBundleID"
```

---

## Task 3: StyleProfileService — Prompt Merging

**Files:**
- Create: `Sources/Services/StyleProfileService.swift`
- Test: `Tests/StyleProfileServiceTests.swift` (extend)

- [ ] **Step 1: Write failing tests for prompt merging**

Add to `Tests/StyleProfileServiceTests.swift`:

```swift
func testBuildSystemPromptWithNoProfile() {
    let service = StyleProfileService.shared
    let prompt = service.buildSystemPrompt(appBundleID: nil)
    XCTAssertTrue(prompt.contains("filler words"))
    // Base prompt only when no profile is active
}

func testBuildSystemPromptWithToneRule() {
    let service = StyleProfileService.shared
    let profile = StyleProfile(name: "Test", isActive: true)
    try? service.saveStyleProfile(profile)
    let rule = ToneRule(description: "formal", instructions: "Write formally", profileID: profile.id)
    try? service.saveToneRule(rule)

    let prompt = service.buildSystemPrompt(appBundleID: nil)
    XCTAssertTrue(prompt.contains("Write formally"))

    try? service.deleteStyleProfile(profile.id)
}

func testBuildSystemPromptWithAppTone() {
    let service = StyleProfileService.shared
    let profile = StyleProfile(name: "Test", isActive: true)
    try? service.saveStyleProfile(profile)
    let rule = AppToneRule(bundleID: "com.apple.mail", appName: "Mail",
                          toneDescription: "Professional", instructions: "Write professionally for email",
                          profileID: profile.id)
    try? service.saveAppToneRule(rule)

    let prompt = service.buildSystemPrompt(appBundleID: "com.apple.mail")
    XCTAssertTrue(prompt.contains("Write professionally for email"))

    try? service.deleteStyleProfile(profile.id)
}

func testBuildTranslationPrompt() {
    let service = StyleProfileService.shared
    let prompt = service.buildTranslationPrompt(from: "en", to: "zh", appBundleID: nil)
    XCTAssertTrue(prompt.contains("Translate"))
    XCTAssertTrue(prompt.contains("en"))
    XCTAssertTrue(prompt.contains("zh"))
}

func testTokenBudgetTruncatesExamples() {
    // Create a style example with very long text (> 300 tokens ≈ 1200 chars)
    let longText = String(repeating: "This is a sample sentence. ", count: 100)
    let service = StyleProfileService.shared
    let profile = StyleProfile(name: "Budget Test", isActive: true)
    try? service.saveStyleProfile(profile)
    let example = StyleExample(rawText: longText, polishedText: longText, profileID: profile.id)
    try? service.saveStyleExample(example)

    let prompt = service.buildSystemPrompt(appBundleID: nil)
    let tokenEstimate = prompt.count / 4
    XCTAssertLessThan(tokenEstimate, 1300) // Overhead budget

    try? service.deleteStyleProfile(profile.id)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift test --filter StyleProfileServiceTests`
Expected: FAIL — `StyleProfileService` not defined

- [ ] **Step 3: Implement StyleProfileService**

```swift
// Sources/Services/StyleProfileService.swift
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
    private let maxTotalOverheadTokens = 1300

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

        // Add app-specific tone (overrides global)
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

        // Add app tone if applicable
        if let profile = getActiveProfile(),
           let bundleID = appBundleID,
           let appTone = (try? store.getAppToneRules(for: profile.id))?.first(where: { $0.bundleID == bundleID }) {
            parts.append(appTone.instructions)
        }

        // Add style context for rephrase/changeTone
        if case .rephrase = command, let profile = getActiveProfile() {
            let examples = (try? store.getStyleExamples(for: profile.id)) ?? []
            if let example = examples.first {
                parts.append("Style reference — Input: \(example.rawText) Output: \(example.polishedText)")
            }
        }

        // Add read-only vs replace instruction
        if command.isReadOnly {
            parts.append(isChinese ? "返回结果，不要修改原始文本。" : "Return the result. Do NOT modify the original text.")
        } else {
            parts.append(isChinese ? "只返回修改后的文本，不要添加任何解释。" : "Return ONLY the modified text. Do not include explanations.")
        }

        return parts.joined(separator: "\n")
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

    public func saveStyleProfile(_ profile: StyleProfile) throws {
        try store.saveStyleProfile(profile)
    }

    public func deleteStyleProfile(_ id: UUID) throws {
        try store.deleteStyleProfile(id)
    }

    public func getAllStyleProfiles() throws -> [StyleProfile] {
        try store.getAllStyleProfiles()
    }

    public func setActiveProfile(_ id: UUID) throws {
        let profiles = try store.getAllStyleProfiles()
        for profile in profiles {
            var updated = profile
            updated.isActive = (profile.id == id)
            updated.updatedAt = Date()
            try store.saveStyleProfile(updated)
        }
    }

    public func saveStyleExample(_ example: StyleExample) throws {
        try store.saveStyleExample(example)
    }

    public func deleteStyleExample(_ id: UUID) throws {
        try store.deleteStyleExample(id)
    }

    public func saveToneRule(_ rule: ToneRule) throws {
        try store.saveToneRule(rule)
    }

    public func deleteToneRule(_ id: UUID) throws {
        try store.deleteToneRule(id)
    }

    public func saveAppToneRule(_ rule: AppToneRule) throws {
        try store.saveAppToneRule(rule)
    }

    public func deleteAppToneRule(_ id: UUID) throws {
        try store.deleteAppToneRule(id)
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift test --filter StyleProfileServiceTests`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add Sources/Services/StyleProfileService.swift Tests/StyleProfileServiceTests.swift
git commit -m "feat: add StyleProfileService with prompt merging and token budget"
```

---

## Task 4: AIProvider Protocol Change

**Files:**
- Modify: `Sources/Providers/AI/AIProvider.swift`
- Modify: All 7 AI providers
- Modify: `Sources/Services/AIProcessingService.swift`

- [ ] **Step 1: Update AIProvider protocol**

In `Sources/Providers/AI/AIProvider.swift`:

```swift
public protocol AIProvider: Sendable {
    var name: String { get }
    func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String
    func translate(prompt: String, text: String, from: String, to: String, apiKey: String, model: String?) async throws -> String
}
```

Remove `removeFillers()`. Add `prompt` parameter to both methods.

- [ ] **Step 2: Update OpenAIProvider**

In `Sources/Providers/AI/OpenAIProvider.swift`:
- Change `process(text:apiKey:model:)` to `process(prompt:text:apiKey:model:)`
- Use `prompt` as the system message content (replace hardcoded system prompt)
- Use `text` as the user message content
- Delete `removeFillers()` method
- Change `translate(text:from:to:apiKey:model:)` to `translate(prompt:text:from:to:apiKey:model:)`
- Use `prompt` as system message for translation

- [ ] **Step 3: Update AnthropicProvider**

Same changes as OpenAIProvider: add `prompt` param, remove hardcoded prompts, remove `removeFillers()`.

- [ ] **Step 4: Update remaining 5 AI providers**

Same pattern for: `DeepSeekProvider.swift`, `GroqAIProvider.swift`, `ZhipuProvider.swift`, `MiniMaxProvider.swift`, `MoonshotProvider.swift`.

- [ ] **Step 5: Update AIProcessingService**

In `Sources/Services/AIProcessingService.swift`:
- Remove `removeFillers()` method
- Add `appBundleID` parameter to `process()` and `translate()`
- Add `processWithPrompt(prompt:text:)` method
- Wire up `StyleProfileService.shared.buildSystemPrompt()` and `buildTranslationPrompt()`

```swift
public func process(text: String, appBundleID: String? = nil) async throws -> String {
    let provider = getProvider()
    guard let apiKey = getAPIKey(for: provider.name) else { throw AIError.apiKeyNotFound }
    let model = getModel(for: provider.name)
    let prompt = StyleProfileService.shared.buildSystemPrompt(appBundleID: appBundleID)
    return try await provider.process(prompt: prompt, text: text, apiKey: apiKey, model: model)
}

public func processWithPrompt(prompt: String, text: String) async throws -> String {
    let provider = getProvider()
    guard let apiKey = getAPIKey(for: provider.name) else { throw AIError.apiKeyNotFound }
    let model = getModel(for: provider.name)
    return try await provider.process(prompt: prompt, text: text, apiKey: apiKey, model: model)
}

public func translate(text: String, from: String, to: String, appBundleID: String? = nil) async throws -> String {
    let provider = getProvider()
    guard let apiKey = getAPIKey(for: provider.name) else { throw AIError.apiKeyNotFound }
    let model = getModel(for: provider.name)
    let prompt = StyleProfileService.shared.buildTranslationPrompt(from: from, to: to, appBundleID: appBundleID)
    return try await provider.translate(prompt: prompt, text: text, from: from, to: to, apiKey: apiKey, model: model)
}
```

- [ ] **Step 6: Build and verify compilation**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift build`
Expected: BUILD SUCCEEDED

- [ ] **Step 7: Commit**

```bash
git add Sources/Providers/AI/AIProvider.swift Sources/Providers/AI/*.swift Sources/Services/AIProcessingService.swift
git commit -m "feat: refactor AIProvider protocol — add prompt param, remove removeFillers, wire StyleProfileService"
```

---

## Task 5: PopoverViewModel — appBundleID + Style Learning

**Files:**
- Modify: `Sources/UI/Popover/PopoverViewModel.swift`
- Modify: `Sources/UI/Popover/PopoverView.swift`

- [ ] **Step 1: Capture appBundleID in PopoverViewModel**

In `Sources/UI/Popover/PopoverViewModel.swift`, at `stopRecording()`:
```swift
let frontmostBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
```

Pass `appBundleID` to `aiService.process(text:appBundleID:)` and save it in the `HistoryEntry`.

- [ ] **Step 2: Add style example save action**

Add `@Published var canSaveStyleExample = false` and `@Published var didSaveStyleExample = false` properties.

After successful basic/hands-free processing:
- Set `canSaveStyleExample = true`
- Show button in PopoverView

Add method:
```swift
func saveAsStyleExample() {
    guard let profile = try? StyleProfileService.shared.getAllStyleProfiles().first(where: { $0.isActive }) else { return }
    let example = StyleExample(
        rawText: lastRawText,
        polishedText: transcribedText,
        appBundleID: lastAppBundleID,
        profileID: profile.id
    )
    try? StyleProfileService.shared.saveStyleExample(example)
    didSaveStyleExample = true
    canSaveStyleExample = false
}
```

- [ ] **Step 3: Add "Save style example" button to PopoverView**

In `Sources/UI/Popover/PopoverView.swift`, after the transcription result section:
```swift
if viewModel.canSaveStyleExample && !viewModel.didSaveStyleExample {
    Button(action: { viewModel.saveAsStyleExample() }) {
        Label("Save as Style Example", systemImage: "text.badge.star")
    }
    .buttonStyle(.borderless)
    .font(.caption)
}
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift build`
Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git add Sources/UI/Popover/PopoverViewModel.swift Sources/UI/Popover/PopoverView.swift
git commit -m "feat: capture appBundleID, add style example save button to popover"
```

---

## Task 6: Per-App Tone Settings UI

**Files:**
- Modify: `Sources/UI/Windows/Views/SettingsView.swift`
- Create: `Sources/UI/Windows/Views/StyleSettingsView.swift`
- Modify: `Sources/Data/SettingsStore.swift`
- Modify: `Sources/Utilities/Constants.swift`

- [ ] **Step 1: Add suggestedAppTones to SettingsStore**

In `Sources/Data/SettingsStore.swift`:
```swift
@Published public var suggestedAppTones: [String: Date] = [:] {
    didSet { defaults.set(try? JSONEncoder().encode(suggestedAppTones), forKey: "suggestedAppTones") }
}
```

Add pruning in `init()`: remove entries older than 90 days.

- [ ] **Step 2: Add recentLocales to SettingsStore**

```swift
@Published public var recentLocales: [String] = [Locale.current.identifier] {
    didSet { defaults.set(recentLocales, forKey: "recentLocales") }
}
```

- [ ] **Step 3: Create StyleSettingsView**

New `Sources/UI/Windows/Views/StyleSettingsView.swift` with:
- Active StyleProfile picker (create/select/delete)
- Style Examples list (review/delete)
- App Tones list (add/edit/delete per-app rules with tone presets)
- Global Tone section (add/remove tone rules with presets)

- [ ] **Step 4: Add Style tab to SettingsView**

In `Sources/UI/Windows/Views/SettingsView.swift`, add:
```swift
StyleSettingsView().tabItem {
    Label("Style", systemImage: "paintbrush")
}.tag(5)
```

Shift other tab tags (Data → 6, About → 7 or renumber as needed).

- [ ] **Step 5: Build and verify**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift build`
Expected: BUILD SUCCEEDED

- [ ] **Step 6: Commit**

```bash
git add Sources/UI/Windows/Views/StyleSettingsView.swift Sources/UI/Windows/Views/SettingsView.swift Sources/Data/SettingsStore.swift Sources/Utilities/Constants.swift
git commit -m "feat: add Style settings tab with profile picker, app tones, style examples"
```

---

## Task 7: EditCommandDetector + Enhanced Edit Mode

**Files:**
- Create: `Sources/Utilities/EditCommandDetector.swift`
- Modify: `Sources/UI/Popover/PopoverViewModel.swift`
- Modify: `Sources/Services/TextInsertionService.swift`
- Test: `Tests/EditCommandDetectorTests.swift`

- [ ] **Step 1: Write failing tests for EditCommandDetector**

```swift
// Tests/EditCommandDetectorTests.swift
import XCTest
@testable import Utilities
@testable import Models

final class EditCommandDetectorTests: XCTestCase {

    func testDetectRephrase() {
        XCTAssertEqual(EditCommandDetector.detect(from: "rephrase this"), .rephrase)
        XCTAssertEqual(EditCommandDetector.detect(from: "rewrite it"), .rephrase)
    }

    func testDetectShorten() {
        XCTAssertEqual(EditCommandDetector.detect(from: "shorten this"), .shorten)
        XCTAssertEqual(EditCommandDetector.detect(from: "condense"), .shorten)
    }

    func testDetectLengthen() {
        XCTAssertEqual(EditCommandDetector.detect(from: "lengthen"), .lengthen)
        XCTAssertEqual(EditCommandDetector.detect(from: "elaborate"), .lengthen)
    }

    func testDetectSummarize() {
        XCTAssertEqual(EditCommandDetector.detect(from: "summarize"), .summarize)
    }

    func testDetectExplain() {
        XCTAssertEqual(EditCommandDetector.detect(from: "explain this"), .explain)
    }

    func testDetectTranslate() {
        if case .translate(let lang) = EditCommandDetector.detect(from: "translate to Chinese") {
            XCTAssertEqual(lang, "Chinese")
        } else {
            XCTFail("Expected translate command")
        }
    }

    func testDetectFixGrammar() {
        XCTAssertEqual(EditCommandDetector.detect(from: "fix grammar"), .fixGrammar)
    }

    func testDetectCustom() {
        XCTAssertEqual(EditCommandDetector.detect(from: "make it sound like Shakespeare"), .custom)
    }

    func testSummarizeIsReadOnly() {
        XCTAssertTrue(EditCommandDetector.detect(from: "summarize").isReadOnly)
    }

    func testRephraseIsNotReadOnly() {
        XCTAssertFalse(EditCommandDetector.detect(from: "rephrase").isReadOnly)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift test --filter EditCommandDetectorTests`
Expected: FAIL — `EditCommandDetector` not defined

- [ ] **Step 3: Implement EditCommandDetector**

```swift
// Sources/Utilities/EditCommandDetector.swift
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift test --filter EditCommandDetectorTests`
Expected: All 10 tests PASS

- [ ] **Step 5: Add insertTextAfterSelection to TextInsertionService**

In `Sources/Services/TextInsertionService.swift`:

```swift
public func insertTextAfterSelection(_ text: String) {
    // Collapse selection to end by pressing Right arrow
    let source = CGEventSource(stateID: .hidSystemState)
    let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 0x7C, keyDown: true) // Right arrow
    keyDown?.post(tap: .cgAnnotatedSessionEventTap)
    let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 0x7C, keyDown: false)
    keyUp?.post(tap: .cgAnnotatedSessionEventTap)

    // Small delay to let cursor move
    usleep(50000)

    // Insert text with newline prefix for visual separation
    insertText("\n" + text)
}
```

- [ ] **Step 6: Update PopoverViewModel edit mode flow**

In `processEditSelected()`:
1. Replace the hardcoded Chinese prompt with `EditCommandDetector.detect(voiceText:)`
2. Build edit prompt via `StyleProfileService.shared.buildEditPrompt(selectedText:command:appBundleID:)`
3. Call `aiService.processWithPrompt(prompt:text:)`
4. Route: if command `.isReadOnly`, use `textInserter.insertTextAfterSelection()`; otherwise use `replaceSelectedText()`
5. Set `@Published var detectedEditCommand: EditCommand?` for UI display

- [ ] **Step 7: Add edit command label to PopoverView**

Show `viewModel.detectedEditCommand?.displayLabel` after edit operations.

- [ ] **Step 8: Build and verify**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift build`
Expected: BUILD SUCCEEDED

- [ ] **Step 9: Commit**

```bash
git add Sources/Utilities/EditCommandDetector.swift Sources/Services/TextInsertionService.swift Sources/UI/Popover/PopoverViewModel.swift Sources/UI/Popover/PopoverView.swift Tests/EditCommandDetectorTests.swift
git commit -m "feat: add EditCommandDetector, insertTextAfterSelection, enhanced edit mode"
```

---

## Task 8: Language Auto-Detection

**Files:**
- Create: `Sources/Providers/Transcription/AppleSpeechAutoDetector.swift`
- Modify: `Sources/Providers/Transcription/AppleSpeechProvider.swift`
- Modify: `Sources/Providers/Transcription/GroqTranscriptionProvider.swift`
- Modify: `Sources/Providers/Transcription/OpenAIWhisperProvider.swift`
- Modify: `Sources/Providers/Transcription/AliyunASRProvider.swift`
- Modify: `Sources/Data/VoiceModeConfig.swift`
- Modify: `Sources/UI/Popover/PopoverViewModel.swift`

- [ ] **Step 1: Add autoDetectLanguage to VoiceModeConfig**

In `Sources/Data/VoiceModeConfig.swift`:
```swift
public var autoDetectLanguage: Bool
```

Add custom `Codable` init with `decodeIfPresent` defaulting to `true`, and explicit `encode(to:)`.

- [ ] **Step 2: Create AppleSpeechAutoDetector**

```swift
// Sources/Providers/Transcription/AppleSpeechAutoDetector.swift
import Speech

class AppleSpeechAutoDetector {
    private let locales: [Locale]

    init(locales: [Locale]) {
        self.locales = locales
    }

    func detect(audioURL: URL) async throws -> (text: String, locale: Locale, confidence: Float) {
        try await withThrowingTaskGroup(of: (String, Locale, Float).self) { group in
            for locale in locales {
                group.addTask {
                    let recognizer = SFSpeechRecognizer(locale: locale)!
                    let request = SFSpeechURLRecognitionRequest(url: audioURL)
                    let result = try await recognizer.recognitionTask(with: request)
                    let avgConfidence = result.bestTranscription.segments.map(\.confidence).reduce(0, +)
                        / Float(max(result.bestTranscription.segments.count, 1))
                    return (result.bestTranscription.formattedString, locale, avgConfidence)
                }
            }
            var bestResult: (String, Locale, Float) = ("", self.locales[0], 0)
            for try await result in group {
                if result.2 > bestResult.2 { bestResult = result }
            }
            return bestResult
        }
    }
}
```

- [ ] **Step 3: Update AppleSpeechProvider for auto-detect**

When `language` is nil and auto-detect is on:
- Read `recentLocales` from SettingsStore
- Create `AppleSpeechAutoDetector` with top 3 locales
- Call `detect()` and return result with `detectedLanguage` set
- Update `recentLocales` with detected locale

- [ ] **Step 4: Update GroqTranscriptionProvider**

- When language is nil (auto-detect), omit `language` from form data
- Set model to `whisper-large-v3` when auto-detect on or language is non-English
- Keep `distil-whisper-large-v3-en` only when auto-detect off and language is English
- Populate `detectedLanguage` from `WhisperResponse.language`

- [ ] **Step 5: Update OpenAIWhisperProvider**

- When language is nil, omit from request
- Populate `detectedLanguage` from response

- [ ] **Step 6: Update AliyunASRProvider**

- Support nil language parameter
- Populate `detectedLanguage` from response when available

- [ ] **Step 7: Update PopoverViewModel**

- Check `voiceModeConfigs[currentMode]?.autoDetectLanguage ?? true`
- Pass nil for language when auto-detect is on
- Display detected language badge

- [ ] **Step 8: Add auto-detect toggle to Transcription settings**

In the Transcription tab of settings, add "Auto-detect language" toggle that updates `VoiceModeConfig.autoDetectLanguage`.

- [ ] **Step 9: Build and verify**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift build`
Expected: BUILD SUCCEEDED

- [ ] **Step 10: Commit**

```bash
git add Sources/Providers/Transcription/AppleSpeechAutoDetector.swift Sources/Providers/Transcription/AppleSpeechProvider.swift Sources/Providers/Transcription/GroqTranscriptionProvider.swift Sources/Providers/Transcription/OpenAIWhisperProvider.swift Sources/Providers/Transcription/AliyunASRProvider.swift Sources/Data/VoiceModeConfig.swift Sources/UI/Popover/PopoverViewModel.swift
git commit -m "feat: add language auto-detection — Apple Speech parallel locales, Groq multilingual model, detectedLanguage"
```

---

## Task 9: Integration + Version Bump

**Files:**
- Modify: `Sources/Utilities/Constants.swift` (version bump)
- All integration wiring

- [ ] **Step 1: Bump version to 0.6.0**

In `Sources/Utilities/Constants.swift`:
```swift
public static let appVersion = "0.6.0"
```

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/peterzhang/OpenType/OpenType && swift test`
Expected: All tests PASS

- [ ] **Step 3: Manual smoke test**

1. Launch app, verify basic dictation still works (no style profile)
2. Create a StyleProfile in Settings > Style
3. Add an app tone rule for an app (e.g., Mail = Professional)
4. Dictate in that app — verify tone changes
5. Click "Save as style example" after dictation
6. Switch language auto-detect on, dictate in another language, verify detection
7. Use Edit mode with "summarize", "rephrase", "translate to Chinese" — verify commands work
8. Verify summarize/explain insert after selection (read-only behavior)

- [ ] **Step 4: Commit version bump**

```bash
git add Sources/Utilities/Constants.swift
git commit -m "release: v0.6.0 — style learning, per-app tone, language auto-detect, enhanced editing"
```