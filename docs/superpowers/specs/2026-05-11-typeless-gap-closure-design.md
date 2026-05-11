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
- `style_examples` — StyleExample rows, FK to style_profiles
- `tone_rules` — ToneRule rows, FK to style_profiles
- `app_tone_rules` — AppToneRule rows, FK to style_profiles

SQLite is preferred over UserDefaults for style examples because:
- Style examples can grow unbounded (each dictation = one example)
- UserDefaults has no practical size limits but queries are inefficient for collections
- HistoryStore already manages SQLite, adding tables is natural

### Style Learning — Explicit Opt-In

After each dictation, the popover shows an "Accept as style example" button. When tapped:
1. The raw transcribed text + final polished text are saved as a `StyleExample`
2. The `appBundleID` is captured from `NSWorkspace.shared.frontmostApplication`
3. The example is associated with the active `StyleProfile`

Users can review and delete style examples in Settings > Style. This ensures training data quality — only output the user explicitly approves enters the style profile.

### Prompt Merging

The key method on StyleProfileService:

```swift
func buildPrompt(rawText: String, mode: VoiceMode, appBundleID: String?) -> String
```

Assembly order:
1. **Base system prompt** — the current hardcoded prompt (filler removal, formatting, repetition cleanup)
2. **Global tone rules** — merge `ToneRule.instructions` from the active StyleProfile
3. **App-specific tone** — if `appBundleID` matches an `AppToneRule`, merge those instructions (override/supplement global tone)
4. **Few-shot examples** — append 2-3 most relevant `StyleExample` pairs as context (prioritize examples from the same app, then most recent)
5. **User text** — append the raw transcribed text

The final prompt is a single string passed to the AI provider.

### AIProvider Protocol Change

Current protocol:
```swift
func process(text: String, apiKey: String, model: String) async throws -> String
```

New protocol:
```swift
func process(prompt: String, text: String, apiKey: String, model: String) async throws -> String
```

The `prompt` parameter contains the fully assembled system prompt. The `text` parameter is the user's transcribed text. This separates prompt construction (in StyleProfileService) from prompt execution (in providers).

All 7 AI providers update to use the `prompt` parameter as the system message and `text` as the user message. The hardcoded prompts are removed from providers.

### AIProcessingService Change

`AIProcessingService` gains a dependency on `StyleProfileService`:
```swift
func process(text: String, appBundleID: String? = nil) async throws -> String {
    let prompt = styleProfileService.buildPrompt(
        rawText: text, mode: currentMode, appBundleID: appBundleID
    )
    let provider = AIProviderFactory.makeProvider(name: settings.selectedAIProvider)
    return try await provider.process(
        prompt: prompt, text: text,
        apiKey: keychain.getKey(for: settings.selectedAIProvider),
        model: settings.selectedAIModel
    )
}
```

### New Files

| File | Location | Purpose |
|---|---|---|
| `StyleProfileService.swift` | `Services/` | Prompt merging, style profile CRUD |
| `StyleProfile.swift` | `Models/` | StyleProfile, StyleExample, ToneRule, AppToneRule structs |

### Modified Files

| File | Change |
|---|---|
| `AIProvider.swift` | Protocol: add `prompt` parameter to `process()` |
| `All 7 AI providers` | Use `prompt` as system message, remove hardcoded prompts |
| `AIProcessingService.swift` | Add `appBundleID` param, call StyleProfileService |
| `PopoverViewModel.swift` | Pass `appBundleID` to AIProcessingService, add "save style" action |
| `HistoryStore.swift` | Add 4 new SQLite tables + CRUD methods |
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

The auto-suggest fires only once per app (track in UserDefaults: `suggestedAppTones: Set<String>`).

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
- Modify `AppleSpeechProvider` to support auto-detect mode: when `language` is nil, do not pin a locale on `SFSpeechRecognizer`
- `SFSpeechRecognitionResult` returns the detected locale — extract and return in `TranscriptionResult.detectedLanguage`
- Fallback: if auto-detect fails or returns unsupported locale, use user's configured `sourceLanguage`

**Tier 2 — Cloud providers (Whisper/Groq/Aliyun, 99+ languages)**:
- When `language` is nil and auto-detect is on, send requests without the `language` parameter, letting the model auto-detect
- When Apple Speech has already detected a language, pass it as a hint to cloud providers to improve accuracy

### Mixed-Language Support

Whisper inherently handles code-switching. No special handling — the AI post-processing prompt preserves original meaning, which naturally preserves mixed-language content.

### Settings

New `autoDetectLanguage: Bool` property on `VoiceModeConfig` (default: true).

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
| `AppleSpeechProvider.swift` | Add auto-detect mode (no locale pinned) |
| `OpenAIWhisperProvider.swift` | Support nil language parameter |
| `GroqTranscriptionProvider.swift` | Support nil language parameter |
| `AliyunASRProvider.swift` | Support nil language parameter |
| `TranscriptionService.swift` | Pass language=nil when auto-detect on |
| `PopoverViewModel.swift` | Use VoiceModeConfig.autoDetectLanguage |
| `VoiceModeConfig.swift` | Add `autoDetectLanguage: Bool` |
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
| Shorten | "shorten", "make shorter", "condense", "summarize" | AI condenses the text |
| Lengthen | "lengthen", "expand", "elaborate", "make longer" | AI expands with more detail |
| Change tone | "make formal", "make casual", "make professional" | AI adjusts tone (uses StyleProfileService tone) |
| Translate | "translate to [lang]" | AI translates selected text |
| Summarize | "summarize", "give me a summary" | AI produces a concise summary |
| Explain | "explain", "what does this mean" | AI explains the text |
| Fix grammar | "fix grammar", "correct" | AI fixes grammar/spelling only |
| Custom | (anything else) | AI interprets as free-form edit instruction |

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
- AI output is **inserted after the selection** via `TextInsertionService.insertText()`
- Original text remains untouched
- This enables analysis of text the user can't modify (received emails, documentation)

### Style-Aware Editing

When a StyleProfile is active and the command benefits from style context (rephrase, change tone):
- `StyleProfileService.buildPrompt()` includes relevant style examples
- The edit prompt wraps the selected text with style context

### Prompt Construction

```swift
func buildEditPrompt(selectedText: String, command: EditCommand,
                     appBundleID: String?) -> String
```

Template:
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
  -> AppleSpeechProvider streams partial results (auto-detect language)

User stops recording
  -> PopoverViewModel.stopRecording()
  -> Capture frontmostBundleID from NSWorkspace
  -> TranscriptionService.transcribe(audioURL:, language: nil)
       [if auto-detect: provider detects language]
       [if manual: use VoiceModeConfig.sourceLanguage]
  -> DictionaryService.applyReplacements(to: rawText)
  -> StyleProfileService.buildPrompt(rawText:, mode:, appBundleID:)
       [merge: base prompt + tone rules + app tone + style examples]
  -> AIProcessingService.process(text:, appBundleID:)
       [provider executes with assembled prompt]
  -> For edit mode: EditCommandDetector.detect(voiceText)
       [route to replace or insert-after based on command]
  -> TextInsertionService inserts/replaces text
  -> HistoryEntry saved
  -> DictionaryService.learnFromText()
  -> Prompt: "Accept as style example?" (if not already saved)
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