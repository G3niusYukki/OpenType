# OpenType v0.9.1 Release Notes

## Quality Foundation — CI Fixes, Provider Deduplication, Project Hygiene

v0.9.1 is the first release of the quality-first improvement plan. No user-facing features; this release fixes systemic engineering issues and establishes the foundation for future development speed.

---

## Changes

### CI Pipeline Fixed

The quality CI workflow was silently suppressing test failures:

- **`swift test 2>/dev/null` removed** — test failures now block CI, as they should
- **Swift Format enforced** — `brew install swift-format && swift-format lint --strict` now runs on every push
- **Dependabot added** — weekly dependency updates for SPM packages and GitHub Actions
- **`"APPL????"` placeholder removed** from DMG creation step

### Provider Code Deduplication

~150 lines of duplicated code eliminated across 7 AI providers:

- **`ProviderHTTPClient` protocol** — shared JSON POST helper with Bearer token auth
- **`ChatCompletionRequest` / `ChatCompletionResponse`** — shared types for OpenAI-compatible providers
- **`translate()` default** — protocol extension delegates to `process()`; 6 duplicated translate implementations removed
- **Model updated** — Anthropic Claude default model bumped to `claude-3-5-sonnet-20241022`

### Project Hygiene

- `project.yml` version bumped from 0.1.0 → 0.9.1
- `OpenType-iOS/` now has a README documenting planned status
- `.gitignore` updated to cover `.build-scratch` and `.build-native`
- `IMPROVEMENT_PLAN.md` rewritten as comprehensive quality-first roadmap

---

# OpenType v0.8.0 Release Notes

## Typeless Gap Closure — Audio Waveform, Status Bar Icons, Sound Feedback, Quick Answer

v0.8.0 closes 4 remaining easy-to-address gaps with Typeless: real-time audio visualization, dynamic status bar state, recording sound feedback, and a new Quick Answer mode for conversational AI interaction.

---

## New Features

### Audio Waveform Visualization

See your voice while you speak:

- **Pulsing Ring** — The recording button now has an outer ring that scales and brightens with your voice. Silent pauses → ring shrinks; speaking → ring expands.
- **Real-Time** — RMS audio level sampled every 50ms with exponential smoothing, displayed smoothly via SwiftUI animation.

### Dynamic Status Bar Icons

The menu bar icon now reflects what's happening:

- **Red mic** — recording in progress
- **Blue spinner** — AI processing
- **Orange exclamation mic** — error (auto-reverts after 3s)
- **Gray mic** — idle

No more guessing whether your hotkey press was registered.

### Recording Sound Feedback

Press a hotkey, hear a confirmation:

- **Start recording** — subtle "Tink" sound
- **Stop recording** — satisfying "Pop" sound
- **Toggle** — disable in Settings > General if you prefer silence

### Quick Answer Mode (⌘⇧Q)

Ask a question via voice, get an AI answer:

- **New Voice Mode** — ⌘⇧Q opens Quick Answer. Speak your question.
- **Streaming AI Answer** — Answer appears word-by-word in the popover.
- **Review Before Insert** — Unlike Basic mode, answers are NOT auto-inserted. You review, then click "Insert" or "Copy".
- **QA-Optimized Prompt** — Dedicated system prompt instructs the AI to give concise, accurate answers.

---

# OpenType v0.7.0 Release Notes

## Stability & Reliability — Production-Grade Text Insertion, AI Streaming, 24/7 Uptime

v0.7.0 makes OpenType reliable enough for daily use. Text insertion no longer clobbers your clipboard, AI output streams in real-time, and the app stays healthy during long menu bar sessions.

---

## New Features

### Protected Text Insertion

Your clipboard is now safe:

- **ClipboardGuard** — Every text insertion saves and restores your clipboard content automatically. Copy something, dictate, and your original clipboard is preserved.
- **AX Direct Injection** — New preferred insertion method using the Accessibility API. No clipboard swap needed for native macOS controls (NSTextField, NSTextView, Safari, etc.).
- **Strategy Chain** — If AX fails, falls back to CGEvent paste → AppleScript keystroke → clipboard copy. Every path preserves your clipboard.
- **Typed Errors** — Specific error messages when insertion fails: "需要辅助功能权限" for missing accessibility permission, "文本已复制到剪贴板" when fallback to clipboard is needed.

### Real-Time AI Streaming

See your text as the AI writes it:

- **Word-by-Word Output** — AI-processed text now appears progressively in the popover, not all at once after a 3-5 second wait.
- **SSE Streaming** — OpenAI provider uses Server-Sent Events for streaming. Other providers use the existing request/response with a protocol-level fallback.
- **Graceful Degradation** — If streaming fails mid-request, automatically falls back to non-streaming mode.

### Automatic Error Recovery

Transient failures no longer break your workflow:

- **Exponential Backoff** — Network timeouts and API errors are retried automatically with exponential backoff (1s → 2s → 4s) and jitter.
- **Provider Failover** — If your selected AI provider fails, OpenType cascades through all 7 providers (OpenAI → Groq → Anthropic → DeepSeek → Zhipu → MiniMax → Moonshot) until one succeeds.
- **Dynamic Settings** — Failover always reads your current provider setting, not a stale snapshot.

### Long-Running Stability

Built for 24/7 menu bar use:

- **Microphone Hot-Swap** — Unplugging your USB mic no longer crashes the app. AudioDeviceWatcher detects device changes and gracefully stops recording.
- **Health Monitor** — Periodic checks every 2 minutes for memory usage (>200 MB threshold) and stale recordings (>5 minute timeout).
- **Crash Recovery** — If the app crashes mid-recording, the next launch detects the stale state and cleans up orphaned temp files.

---

## Technical Changes

- **TextInsertionService** — Full rewrite with ClipboardGuard integration, AX direct injection, and typed errors.
- **AIProcessingService** — Streaming + retry + failover. `process()` now cascades through providers; `processStreaming()` yields partial text.
- **AIProvider Protocol** — `processStreaming()` added with default non-streaming fallback.
- **AIError** — Consolidated into Providers module (single source of truth).
- **usleep → Thread.sleep** — Replaced blocking `usleep()` calls with explicit `Thread.sleep()`.
- **67 unit tests passing** (up from 38 in v0.6.0). New test files: ClipboardGuardTests, TextInsertionServiceTests, SSEParserTests, RetryPolicyTests, AudioDeviceWatcherTests, HealthMonitorTests, ProviderFailoverTests.

---

## New Files

| File | Purpose |
|------|---------|
| `ClipboardGuard.swift` | Save/restore pasteboard state around text insertion |
| `TextInsertionError.swift` | Typed error hierarchy for insertion failures |
| `SSEParser.swift` | Server-Sent Events parser |
| `RetryPolicy.swift` | Exponential backoff with jitter |
| `AudioDeviceWatcher.swift` | CoreAudio property listener for device changes |
| `HealthMonitor.swift` | Periodic memory and recording state checks |
| `ProviderFailover.swift` | Cascading AI provider selection |

---

# OpenType v0.6.0 Release Notes

## 🎯 Typeless Gap Closure — Style, Tone, Language, Editing

v0.6.0 closes the major feature gap with Typeless, bringing personal writing style learning, per-app tone adaptation, automatic language detection, and enhanced voice editing.

---

## ✨ New Features

### 🎨 Style Profile System

Learn your writing style and apply it to all AI output:

- **Style Examples** — Save any dictation result as a style example. The AI learns your voice from these examples and reproduces it in future output.
- **Tone Rules** — Set global instructions like "be concise" or "use active voice" that shape all AI processing.
- **Tone Presets** — One-click presets: Formal, Casual, Professional, Friendly, Academic, Creative.
- **Multiple Profiles** — Create named profiles (e.g., "Work Email", "Casual Chat") and switch between them.

### 📱 Per-App Tone Adaptation

Different apps, different style:

- **App-Specific Tones** — Set different tone rules per application (e.g., formal for Slack, casual for Messages).
- **Auto-Suggested Apps** — Frequently used apps appear as suggestions for quick setup.
- **Style Tab** — New Style tab in Settings for managing profiles, tones, and examples.

### 🌍 Language Auto-Detection

No more manual locale selection:

- **Apple Speech** — Parallel multi-locale recognition with confidence scoring. Automatically detects which language you're speaking.
- **Groq Whisper** — Smart model selection: uses `whisper-large-v3` for multilingual audio and `distil-whisper-large-v3-en` for English-only.
- **Recent Locales** — Tracks your most-used languages for faster detection.
- **Toggle** — Enable/disable auto-detection per voice mode (default: enabled).

### ✏️ Enhanced Voice Editing

9 edit command types via voice:

| Command | Chinese | English | Action |
|---------|---------|---------|--------|
| Rephrase | 改写 / 重述 | rephrase / rewrite | Replace selection |
| Shorten | 缩短 / 精简 | shorten / condense | Replace selection |
| Lengthen | 扩写 / 展开 | lengthen / expand | Replace selection |
| Change Tone | 改正式 / 改口语 | make formal / make casual | Replace selection |
| Translate | 翻译成英文 | translate to English | Replace selection |
| Summarize | 总结 | summarize | Insert after |
| Explain | 解释 / 说明 | explain | Insert after |
| Fix Grammar | 修正语法 | fix grammar | Replace selection |
| Custom | (any) | (any) | Replace selection |

Read-only commands (summarize, explain, translate) insert text after your selection instead of replacing it.

---

## 🔧 Technical Changes

- **AI Provider Protocol** — `prompt` parameter added as external argument, hardcoded prompts removed from all 7 providers.
- **StyleProfileService** — Singleton prompt construction with token budget (500 instruction / 800 example tokens).
- **HistoryStore** — 4 new SQLite tables for style data, ALTER TABLE migration for app_bundle_id.
- **EditCommandDetector** — Keyword matching with locale-aware prompts (Chinese/English).
- **AppleSpeechAutoDetector** — Parallel `SFSpeechRecognizer` instances with segment confidence averaging.
- **38 unit tests passing** (up from 17 in v0.5.0).

---

## 🚀 Installation

### macOS 13+ Users

Download the latest release:

```bash
curl -L -o OpenType.zip https://github.com/G3niusYukki/OpenType/releases/latest/download/OpenType.zip
unzip OpenType.zip
mv OpenType /Applications/
```

Or build from source:

```bash
git clone https://github.com/G3niusYukki/OpenType.git
cd OpenType/OpenType
swift build -c release
```

---

## 📝 API Key Setup

### OpenAI / Groq / Anthropic / DeepSeek / Zhipu / MiniMax / Moonshot
1. Get API key from provider's website
2. Open OpenType → Settings → AI
3. Select provider and enter API key

### Alibaba Cloud ASR
1. Sign up at [Alibaba Cloud](https://www.alibabacloud.com/)
2. Create AccessKey ID and Secret in RAM console
3. Open OpenType → Settings → Transcription
4. Select "Alibaba Cloud ASR" and enter credentials

---

## 📄 License

MIT License © 2024-2026 OpenType Contributors