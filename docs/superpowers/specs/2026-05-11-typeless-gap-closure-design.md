# v0.6.0 Typeless Gap Closure — Design Spec

**Date**: 2026-05-11
**Version**: v0.6.0
**Goal**: Close the feature gap between OpenType and Typeless on macOS, focusing on four must-have capabilities.

## Overview

OpenType is a native macOS menu-bar voice-to-text dictation app (Swift/AppKit/SwiftUI, v0.5.0). Typeless is a cross-platform AI voice keyboard with key differentiators: personal style learning, per-app tone adaptation, 100+ language auto-detection, and rich voice editing commands. This spec defines how OpenType closes these gaps in a single v0.6.0 release using a Foundation-First approach.

## Approach: Foundation-First

Build shared infrastructure (StyleProfileService) first, then stack features on top. This avoids rework since 3 of 4 features depend on prompt-merging infrastructure.

**Build order**:
1. StyleProfileService — shared foundation for style, tone, and enhanced editing
2. Per-app tone adaptation — builds on StyleProfileService
3. Language auto-detection — independent of StyleProfileService, modifies TranscriptionService
4. Enhanced voice editing — builds on StyleProfileService for style-aware edits

---

## Feature 1: StyleProfileService (Foundation)

### Purpose

A new service that manages the user's writing style data and builds context-aware AI prompts by merging a base system prompt with style instructions and tone rules. Replaces hardcoded prompts in all 7 AI providers.

**Relationship to existing `Profile` model**: The current `Profile` struct pairs a transcription provider with an AI provider. `StyleProfile` is a separate concept — it manages style/tone configuration. They are complementary: a user has a Profile (which providers to use) and a StyleProfile (how to write). A future version may merge them, but for v0.6.0 they are independent. Settings shows them in separate tabs.

### Data Model

```
StyleProfile
  id: UUID
  name: String                     // e.g. "My Style"
  styleExamples: [StyleExample]    // collected dictation samples
  toneRules: [ToneRule]            // global tone preferences
  appTones: [AppToneRule]          // per-app tone overrides
  isActive: Bool
  createdAt: Date
  updatedAt: Date

StyleExample
  id: UUID
  rawText: String                  // what user said (transcription output)
  polishedText: String             // AI-processed result user approved
  appBundleID: String?             // which app it was used in
  timestamp: Date

ToneRule
  id: UUID
  description: String              // e.g. "formal", "casual", "concise"
  instructions: String             // prompt fragment

AppToneRule
  bundleID: String                 // e.g. "com.apple.mail"
  appName: String                  // display name
  toneDescription: String          // e.g. "Professional"
  instructions: String             // prompt fragment
```

### Persistence

New SQLite tables in HistoryStore:
- `style_profiles` — StyleProfile rows
- `style_examples` — StyleExample rows, FK to style_profiles (ON DELETE CASCADE)
- `tone_rules` — ToneRule rows, FK to style_profiles (ON DELETE CASCADE)
- `app_tone_rules` — AppToneRule rows, FK to style_profiles (ON DELETE CASCADE)

All child tables use `ON DELETE CASCADE` so deleting a StyleProfile automatically removes its examples, rules, and app tones. Enable `PRAGMA foreign_keys = ON` in HistoryStore's SQLite connection (currently not set).

SQLite is preferred over UserDefaults for style examples because:
- Style examples can grow unbounded (each dictation = one example)
- UserDefaults has no practical size limits but queries are inefficient for collections
- HistoryStore already manages SQLite, adding tables is natural

Also add `appBundleID` column to the existing `history` table so past dictations retain their app context for retroactive style example creation.

### Style Learning — Explicit Opt-In

After each dictation in basic/hands-free/translate modes, the popover shows an "Accept as style example" button. When tapped:
1. The raw transcribed text + final polished text are saved as a `StyleExample`
2. The `appBundleID` is captured from `NSWorkspace.shared.frontmostApplication`
3. The example is associated with the active `StyleProfile`

**Hands-free mode**: Since text is auto-inserted without user interaction, the "Accept as style example" button appears in the popover but is not auto-triggered. The user must click it to save the example. If they don't interact with the popover before it closes, the example is not saved. This keeps hands-free truly hands-free while still allowing style collection when desired.

Users can review and delete style examples in Settings > Style. This ensures training data quality — only output the user explicitly approves enters the style profile.

### Prompt Merging

The key method on StyleProfileService:

```swift
func buildPrompt(rawText: String, appBundleID: String?) -> String
```

The `mode: VoiceMode` parameter is intentionally omitted from the signature — prompt structure does not vary by mode. Mode-specific logic (translate, edit) lives in PopoverViewModel which constructs its own prompts for those modes and calls `buildPrompt` only for basic/hands-free processing.

Assembly order:
1. **Base system prompt** — the current hardcoded prompt (filler removal, formatting, repetition cleanup)
2. **Global tone rules** — merge `ToneRule.instructions` from the active StyleProfile
3. **App-specific tone** — if `appBundleID` matches an `AppToneRule`, merge those instructions (override/supplement global tone)
4. **Few-shot examples** — append 2-3 most relevant `StyleExample` pairs as context (prioritize examples from the same app, then most recent)
5. **User text** — append the raw transcribed text

The final prompt is a single string passed to the AI provider.

### Token Budget

Prompt merging must respect a token budget to avoid exceeding model context windows. Strategy:

- **Base prompt + tone rules + app tone**: max 500 tokens (these are instruction fragments, typically short)
- **Style examples**: max 800 tokens total across 2-3 examples. Truncate individual examples at 300 tokens each. Prioritize same-app examples, then most recent.
- **User text**: no limit (this is the primary content)
- **Total budget**: 1300 tokens of overhead before user text

If the assembled prompt exceeds budget, truncate style examples first (reduce count from 3→2→1→0), then truncate individual example text. The base prompt and tone rules are never truncated.

### No Active Profile Fallback

When no StyleProfile exists (first launch) or no profile is active, `buildPrompt()` returns the base system prompt only — equivalent to v0.5.0 behavior. This fallback ensures the app works immediately after install without requiring style profile setup.

### AIProvider Protocol Change

Current protocol methods (all with hardcoded prompts):
```swift
func process(text: String, apiKey: String, model: String?) async throws -> String
func removeFillers(text: String, apiKey: String, model: String?) async throws -> String
func translate(text: String, from: String, to: String, apiKey: String?, model: String?) async throws -> String
```

New protocol:
```swift
func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String
func translate(prompt: String, text: String, from: String, to: String, apiKey: String?, model: String?) async throws -> String
```

Changes:
- `process()` gains `prompt` parameter — the fully assembled system prompt from StyleProfileService
- `removeFillers()` is **removed** — it was identical to `process()` anyway. Use `process()` with the base prompt instead.
- `translate()` gains `prompt` parameter — allows style-aware translation in the future. For now, pass the translation base prompt.
- The `prompt` parameter is the system message; `text` is the user message. Hardcoded prompts are removed from all 7 providers.

The `removeFillers()` removal is safe because:
1. It used the exact same prompt as `process()`
2. It was only called from `AIProcessingService.removeFillers()` which can now call `process()` with the base prompt

### AIProcessingService Change

`AIProcessingService` gains a dependency on `StyleProfileService`:
```swift
func process(text: String, appBundleID: String? = nil) async throws -> String {
    let prompt = styleProfileService.buildPrompt(
        rawText: text, appBundleID: appBundleID
    )
    let provider = AIProviderFactory.makeProvider(name: settings.selectedAIProvider)
    return try await provider.process(
        prompt: prompt, text: text,
        apiKey: keychain.getKey(for: settings.selectedAIProvider),
        model: settings.selectedAIModel
    )
}

func translate(text: String, from: String, to: String, appBundleID: String? = nil) async throws -> String {
    let prompt = styleProfileService.buildTranslationPrompt(from: from, to: to, appBundleID: appBundleID)
    let provider = AIProviderFactory.makeProvider(name: settings.selectedAIProvider)
    return try await provider.translate(
        prompt: prompt, text: text, from: from, to: to,
        apiKey: keychain.getKey(for: settings.selectedAIProvider),
        model: settings.selectedAIModel
    )
}
```

The `removeFillers()` method is removed. Callers should use `process()` which includes filler removal in its base prompt.

### New Files

| File | Location | Purpose |
|---|---|---|
| `StyleProfileService.swift` | `Services/` | Prompt merging, style profile CRUD |
| `StyleProfile.swift` | `Models/` | StyleProfile, StyleExample, ToneRule, AppToneRule structs |

### Modified Files

| File | Change |
|---|---|
| `AIProvider.swift` | Protocol: add `prompt` param to `process()` and `translate()`, remove `removeFillers()` |
| `All 7 AI providers` | Use `prompt` as system message, remove hardcoded prompts, remove `removeFillers()` impl |
| `AIProcessingService.swift` | Add `appBundleID` param, call StyleProfileService, remove `removeFillers()` |
| `PopoverViewModel.swift` | Pass `appBundleID` to AIProcessingService, add "save style" action |
| `HistoryStore.swift` | Add 4 new SQLite tables + CRUD methods, enable `PRAGMA foreign_keys`, add `appBundleID` to history table |
| `PopoverView.swift` | Add "Accept as style example" button |

---

## Feature 2: Per-App Tone Adaptation

### Purpose

Automatically adjust the AI's writing tone based on which application the user is dictating into. Professional for email, casual for chat, etc.

### App Detection

At `stopRecording()` time (already on `@MainActor`):
```swift
let frontmostBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
```

This bundle ID is:
1. Passed to `AIProcessingService.process(text:appBundleID:)`
2. Stored in the `StyleExample.appBundleID` field
3. Used by `StyleProfileService.buildPrompt()` to look up `AppToneRule`

### Tone Presets

Built-in presets that users can select or customize:

| Preset | Instructions |
|---|---|
| Professional | "Write in a formal, professional tone suitable for business communication" |
| Casual | "Write in a relaxed, conversational tone as if texting a friend" |
| Concise | "Be brief and direct. Remove unnecessary words" |
| Creative | "Use vivid, expressive language. Be creative with word choice" |
| Academic | "Write in a scholarly tone with precise terminology" |

Users can also write custom tone instructions for any app.

### Auto-Suggest

After the first dictation into an app that has no `AppToneRule` configured, show a non-intrusive suggestion in the popover: "Set a tone for [AppName]?" with quick-pick buttons for the presets.

The auto-suggest fires only once per app (track in UserDefaults: `suggestedAppTones: Set<String>`). To prevent unbounded growth, prune entries older than 90 days on each launch (the set only stores bundle IDs, so stale entries for uninstalled apps can be safely removed).

### AppToneRule Storage

`AppToneRule` rows live in the `app_tone_rules` SQLite table, FK to `style_profiles.id`. Switching the active StyleProfile switches the tone rules.

### UI

New "Style" tab in Settings window:
- **Active Profile** dropdown — select which StyleProfile is active
- **Style Examples** section — list of collected examples with delete capability
- **App Tones** section — list of per-app rules with add/edit/remove
- **Global Tone** section — set default tone for all apps
- **Tone Presets** — quick-apply built-in presets

### Modified Files

| File | Change |
|---|---|
| `PopoverViewModel.swift` | Capture `frontmostBundleID` at stopRecording |
| `SettingsTabViews.swift` | Add Style tab |
| `Constants.swift` | Add UserDefaults key for `suggestedAppTones` |

---

## Feature 3: Language Auto-Detection + 100+ Languages

### Purpose

Automatically detect the spoken language and support 100+ languages via cloud providers, instead of requiring manual language selection.

### Two-Tier Detection

**Tier 1 — Apple Speech (on-device, ~60 locales)**:
- `SFSpeechRecognizer` requires a `Locale` at init time — there is no language-agnostic auto-detect mode
- **Auto-detect strategy**: Try the user's top 3 recent locales in parallel (tracked in a `recentLocales: [Locale]` list, updated after each successful detection). Send the audio to multiple recognizers and pick the result with the highest confidence
- On first launch with no history: use `Locale.current` as the single locale
- `SFSpeechRecognitionResult` returns the detected locale — extract and return in `TranscriptionResult.detectedLanguage`
- Fallback: if all parallel recognizers fail or return low confidence, use user's configured `sourceLanguage`
- **When auto-detect is OFF**: Use `Locale.current` or user's configured language (current behavior)

**Tier 2 — Cloud providers (Whisper/Groq/Aliyun, 99+ languages)**:
- When `language` is nil and auto-detect is on, send requests without the `language` parameter, letting the model auto-detect
- When Apple Speech has already detected a language, pass it as a hint to cloud providers to improve accuracy
- **Cloud providers must populate `detectedLanguage`** in `TranscriptionResult` when the API returns a detected language (currently only `language` is set). Add parsing for Whisper API's `detected_language` response field.

**Groq model change**: The current Groq transcription provider hardcodes `distil-whisper-large-v3-en` (English-only). When auto-detect is ON, switch to `whisper-large-v3` (multilingual). When auto-detect is OFF and the configured language is English, continue using `distil-whisper-large-v3-en` for speed.

### Mixed-Language Support

Whisper inherently handles code-switching. No special handling — the AI post-processing prompt preserves original meaning, which naturally preserves mixed-language content.

### Settings

New `autoDetectLanguage: Bool` property on `VoiceModeConfig` (default: true).

**Codable migration**: `VoiceModeConfig` is `Codable` and stored as JSON in UserDefaults. Adding `autoDetectLanguage` requires backward-compatible decoding. Implement using `CodingKeys` + `decodeIfPresent` with default value `true`:
```swift
init(from decoder: Decoder) throws {
    // ... existing properties ...
    autoDetectLanguage = try container.decodeIfPresent(Bool.self, forKey: .autoDetectLanguage) ?? true
}
```
Existing saved configs that lack the key will decode as `true` (auto-detect on by default).

When auto-detect is ON:
- Language selector in settings is hidden/disabled for that mode
- TranscriptionService passes nil for language

When auto-detect is OFF:
- Current behavior (use configured `sourceLanguage`)

### UI Changes

- Settings > Transcription: Add "Auto-detect language" toggle
- PopoverView: Make detected language badge more prominent (already shows `detectedLang`)
- After transcription, show detected language with flag emoji

### Modified Files

| File | Change |
|---|---|
| `AppleSpeechProvider.swift` | Add parallel multi-locale recognition for auto-detect |
| `OpenAIWhisperProvider.swift` | Support nil language, populate `detectedLanguage` from API response |
| `GroqTranscriptionProvider.swift` | Support nil language, switch to `whisper-large-v3` for multilingual, populate `detectedLanguage` |
| `AliyunASRProvider.swift` | Support nil language parameter, populate `detectedLanguage` |
| `TranscriptionService.swift` | Pass language=nil when auto-detect on |
| `PopoverViewModel.swift` | Use VoiceModeConfig.autoDetectLanguage |
| `VoiceModeConfig.swift` | Add `autoDetectLanguage: Bool` with Codable migration |
| `SettingsTabViews.swift` | Add auto-detect toggle |

---

## Feature 4: Enhanced Voice Editing

### Purpose

Expand Edit mode (Cmd+Shift+E) with new edit commands and support for read-only text operations (summarize, explain, translate without modifying the source).

### Edit Commands

Detected from the spoken command using keyword matching:

| Command | Trigger phrases | Action |
|---|---|---|
| Rephrase | "rephrase", "rewrite", "reword" | AI rewrites in different words, same meaning |
| Shorten | "shorten", "make shorter", "condense" | AI condenses the text |
| Lengthen | "lengthen", "expand", "elaborate", "make longer" | AI expands with more detail |
| Change tone | "make formal", "make casual", "make professional" | AI adjusts tone (uses StyleProfileService tone) |
| Translate | "translate to [lang]" | AI translates selected text |
| Summarize | "summarize", "give me a summary" | AI produces a concise summary (read-only) |
| Explain | "explain", "what does this mean" | AI explains the text (read-only) |
| Fix grammar | "fix grammar", "correct" | AI fixes grammar/spelling only |
| Custom | (anything else) | AI interprets as free-form edit instruction |

**Disambiguation**: "summarize" only maps to the `Summarize` command (read-only, insert-after), not `Shorten` (replace). `Shorten` uses "condense", "shorten", "make shorter" only. This avoids the keyword collision where "summarize" previously appeared in both commands with different insertion behaviors.

### Command Detection

In PopoverViewModel, a new `EditCommandDetector` utility:

```swift
enum EditCommand {
    case rephrase, shorten, lengthen, changeTone(TonePreset?)
    case translate(to: String?), summarize, explain, fixGrammar, custom
}

static func detect(from voiceText: String) -> EditCommand
```

Keyword matching against trigger phrases, with tone/translation extraction. Falls back to `.custom` for unrecognized commands.

### Read-Only vs. Replace Behavior

**Replace** (existing behavior): rephrase, shorten, lengthen, change tone, fix grammar, custom
- AI output replaces the selected text via `TextInsertionService.replaceSelectedText()`

**Read-only** (new behavior): summarize, explain, translate
- AI output is **inserted after the selection** via a new `TextInsertionService.insertTextAfterSelection()` method
- Original text remains untouched
- This enables analysis of text the user can't modify (received emails, documentation)

**`insertTextAfterSelection()` implementation**:
1. Use `AXUIElementCopyAttributeValue` to get the selection range (via `kAXSelectedTextRangeAttribute`)
2. Move cursor to the end of the selection: simulate `Cmd+Shift+Right` via CGEvent to deselect and position at end, then use AXUIElement to set `kAXSelectedTextRangeAttribute` to a zero-length range at the selection end
3. If AXUIElement approach fails (some apps don't support `kAXSelectedTextRangeAttribute`), fall back to: (a) copy selected text to clipboard, (b) simulate Right arrow key to move cursor to end of selection, (c) insert new text via existing `insertText()` paste method
4. Add a newline before the inserted text for visual separation

### Style-Aware Editing

When a StyleProfile is active and the command benefits from style context (rephrase, change tone):
- `StyleProfileService.buildPrompt()` includes relevant style examples
- The edit prompt wraps the selected text with style context

### Prompt Construction

```swift
func buildEditPrompt(selectedText: String, command: EditCommand,
                     appBundleID: String?) -> String
```

**Locale-aware prompts**: The current Edit mode uses Chinese prompt templates (`原始文本：`, `编辑指令：`). The new `EditCommandDetector` respects the app's locale:
- If `Locale.current.language.languageCode?.identifier == "zh"`, use Chinese prompt templates
- Otherwise, use English templates
- Tone instructions and style examples are always in the language they were written in (user-authored or preset)

Template (English):
```
Selected text: [selectedText]
Edit command: [commandDescription]
[AppToneRule instructions if applicable]
[Style examples if applicable]

For summarize/explain/translate:
  Return the result. Do NOT modify the original text.

For all other commands:
  Return ONLY the modified text. Do not include explanations.
```

Template (Chinese):
```
原始文本：[selectedText]
编辑指令：[commandDescription]
[AppToneRule instructions if applicable]
[Style examples if applicable]

对于摘要/解释/翻译：
  返回结果，不要修改原始文本。

对于其他命令：
  只返回修改后的文本，不要添加任何解释。
```

### UI Changes

After an edit operation, the popover shows the detected command label:
- "Rephrased" / "Summarized" / "Translated to English" / etc.
- Helps users confirm the AI interpreted their intent correctly

### Modified Files

| File | Change |
|---|---|
| `PopoverViewModel.swift` | Add EditCommandDetector, route summarize/explain/translate to insert-after |
| `TextInsertionService.swift` | Add `insertTextAfterSelection()` method |
| `PopoverView.swift` | Show detected command label after edit |

### New Files

| File | Location | Purpose |
|---|---|---|
| `EditCommandDetector.swift` | `Utilities/` | Parse voice command into EditCommand enum |
| `EditCommand.swift` | `Models/` | EditCommand enum definition |

---

## Data Flow Summary

### Full Pipeline (with all features active)

```
User presses hotkey
  -> PopoverViewModel.startRecording(mode:)
  -> AudioCaptureService starts
  -> AppleSpeechProvider streams partial results
       [if auto-detect: try top 3 recent locales, pick best confidence]
       [if manual: use configured locale]

User stops recording
  -> PopoverViewModel.stopRecording()
  -> Capture frontmostBundleID from NSWorkspace
  -> TranscriptionService.transcribe(audioURL:, language: nil/configured)
       [if auto-detect ON + cloud: provider auto-detects language, populates detectedLanguage]
       [if auto-detect ON + Apple Speech: parallel locale recognition]
       [if auto-detect OFF: use VoiceModeConfig.sourceLanguage]
  -> DictionaryService.applyReplacements(to: rawText)
  -> StyleProfileService.buildPrompt(rawText:, appBundleID:)
       [merge: base prompt + tone rules + app tone + style examples]
       [if no active profile: base prompt only]
  -> AIProcessingService.process(text:, appBundleID:)
       [provider executes with assembled prompt]
  -> For edit mode: EditCommandDetector.detect(voiceText)
       [route to replace or insert-after based on command]
       [use locale-aware prompt template]
  -> TextInsertionService inserts/replaces text
  -> HistoryEntry saved (with appBundleID)
  -> DictionaryService.learnFromText()
  -> Show "Accept as style example?" button in popover
```

### Prompt Merging Flow

```
StyleProfileService.buildPrompt()
  |
  +-- Base system prompt (filler removal, formatting)
  |
  +-- Active ToneRule.instructions (global tone)
  |
  +-- AppToneRule for frontmostBundleID? (app-specific tone, overrides global)
  |
  +-- 2-3 relevant StyleExamples (few-shot context, prioritize same app)
  |
  +-- User's raw transcribed text
  |
  v
  Fully assembled prompt -> AI provider
```

---

## Testing Strategy

### Unit Tests

- `StyleProfileServiceTests`: prompt merging logic, example selection, tone rule resolution
- `EditCommandDetectorTests`: command detection from voice input
- `AppleSpeechProviderTests`: auto-detect language mode
- `LanguageAutoDetectTests`: VoiceModeConfig auto-detect toggle behavior

### Integration Tests

- Full pipeline test: record → transcribe → style-aware process → insert
- App tone switching: change frontmost app → verify different prompt assembled
- Edit mode: test each command type routes to correct insertion strategy

### Manual Tests

- Record in different apps, verify tone adaptation
- Speak in different languages, verify auto-detection
- Use each edit command, verify correct behavior (replace vs. insert-after)
- Style learning: save examples, verify style context appears in subsequent prompts

---

## Scope Exclusions (Future Versions)

These gaps are intentionally deferred beyond v0.6.0:

- **Quick Answers / AI assistant** — new mode for search/brainstorm, significant UX work
- **Whisper mode (quiet dictation)** — hardware-dependent, niche use case
- **HIPAA/GDPR compliance** — legal/certification process, not a code change
- **Cross-platform** — largest effort, separate project (iOS/Android/Windows)
- **Team management** — requires backend infrastructure