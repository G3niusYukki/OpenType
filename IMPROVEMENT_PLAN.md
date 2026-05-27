# OpenType vs Typeless Gap Closure — Improvement Plan

> Based on: OpenType v0.9.0 (commit `cac01eb`) vs Typeless 2026
> Last updated: 2026-05-27
> Status: **Active** — replaces the v0.8.0-era plan

---

## 0. What v0.9.0 Already Shipped (CLOSED gaps)

The previous plan (2026-05-23) was based on v0.8.0 and is now stale. These items are already in production:

| Old Gap | Status | How |
|---------|--------|-----|
| Real-time streaming transcription | ✅ Shipped | `RealtimeTranscriptionService` + `VADDetector` — Apple Speech partial results live in popover |
| Whisper Mode (quiet dictation) | ✅ Shipped | `AudioCaptureService.applyWhisperProcessing()` — noise gate + AGC + soft-clip limiter via vDSP |
| Onboarding wizard | ✅ Shipped | `OnboardingWindowController` + `OnboardingView` — 5-step guided setup |
| Dictionary auto-learn | ✅ Shipped | `DictionaryService.learnFromText()` — NSLinguisticTagger; Smart Suggestions analyzes 100 history entries |
| Streaming AI output | ✅ Shipped | `AIProcessingService.processStreaming()` — `AsyncThrowingStream` for 7 providers |
| Provider Failover | ✅ Shipped | `ProviderFailover` cascades through 7 AI providers |
| HealthMonitor | ✅ Shipped | 2-minute memory/stale-recording checks |
| DiagnosticsService | ✅ Shipped | Mic / Speech / AX / audio devices / network / storage |

---

## 1. Remaining Gaps (verified code-level)

| # | Gap | Severity | Notes |
|---|-----|----------|-------|
| G1 | No Prompt Library — no built-in presets (Improve, Fix Grammar, etc.) | 🔴 High | Typeless has 10+ presets; OpenType has `EditCommand` enum with 9 voice commands, no quick-access preset UI |
| G2 | No mid-pipeline cancel — recording stops but AI processing can't be cancelled | 🔴 High | `PopoverViewModel` has `aiProcessingTask` but no cancel button |
| G3 | Partial results not inserted at cursor — streaming shows in popover but text only inserts after completion | 🔴 High | `insertText()` called once at end; no incremental insertion |
| G4 | Cloud provider streaming missing — only Apple Speech streams live; Whisper / Groq still batch | 🟡 Medium | `TranscriptionProvider.transcribe()` is file-based batch |
| G5 | No per-bundle StyleProfile activation — single global active profile | 🟡 Medium | `StyleProfileService.getActiveProfile()` returns one; `AppToneRule` only adjusts one dimension |
| G6 | No incremental dictionary import — only CSV / TSV text import | 🟡 Medium | `DictionaryService.importFromText()` accepts text only |
| G7 | No automatic style learning — `StyleExamples` must be manually saved | 🟡 Medium | "Save as Style Example" is button-triggered only |
| G8 | No iOS / Android / Windows / Web app | 🔴 Critical long-term | iOS dir exists but has ZERO Swift code |
| G9 | No Ask Selected mode — can't just answer about selected text | 🟡 Medium | `EditCommand` has summarize / explain as read-only but no freeform ask |
| G10 | No web search in Quick Answer — only local LLM | 🟢 Low | Would require external search API |

---

## 2. OpenType strengths to preserve / amplify (Typeless does NOT have)

- BYOK + MIT open source + Keychain key storage
- 11 LLM options including Ollama / LM Studio for fully offline AI
- Provider Failover across 7 providers
- Quick Answer as dedicated mode (⌘⇧Q)
- No 6-min session limit (Typeless has 6-min hard cap)
- Hidden Alibaba Cloud ASR for Chinese market
- Audio replay in history
- Comprehensive diagnostics + HealthMonitor
- Style Profiles with manual few-shot examples (precise control)

---

## 3. Phase Plan

### Phase A — Quick Wins (v0.9.1)

| ID | Title | Gap | Effort | Priority |
|----|-------|-----|--------|----------|
| A1 | Prompt Library (built-in presets + custom) | G1 | 8 h | P0 |
| A2 | Cancel button during AI processing | G2 | 4 h | P0 |
| A3 | Per-bundle StyleProfile auto-switch | G5 | 6 h | P1 |
| A4 | Dictionary import from documents | G6 | 6 h | P1 |

### Phase B — Streaming Closure (v1.0.0)

| ID | Title | Gap | Effort | Priority |
|----|-------|-----|--------|----------|
| B1 | Incremental text insertion (live-at-cursor) | G3 | 16 h | P0 |
| B2 | Cloud provider streaming transcription | G4 | 12 h | P0 |
| B3 | Ask Selected mode | G9 | 4 h | P1 |

### Phase C — Cross-Platform (v1.1.0 — pick one first)

| ID | Title | Gap | Effort | Priority |
|----|-------|-----|--------|----------|
| C1 | Shared Swift Package extraction | G8 | 20 h | P1 |
| C2 | Web app (TypeScript + Web Speech API) **← recommended first** | G8 | 80 h | P1 |
| C3 | iOS app (SwiftUI + Keyboard Extension) | G8 | 120 h | P2 |

### Phase D — Enterprise / Differentiation (v1.2.0+)

| ID | Title | Gap | Effort | Priority |
|----|-------|-----|--------|----------|
| D1 | Automatic style learning from history | G7 | 8 h | P1 |
| D2 | Web search integration for Quick Answer | G10 | 12 h | P2 |
| D3 | Trust Center / enterprise compliance stubs | — | 16 h | P2 |
| D4 | HIPAA readiness (data handling audit) | — | 20 h | P3 |

---

## 4. Architecture Notes for Implementers

### Key Patterns

- **Singleton services**: `AudioCaptureService.shared`, `TranscriptionService.shared`, …
- **Provider pattern**: protocol-based (`TranscriptionProvider`, `AIProvider`) with factory
- **Streaming**: `AsyncThrowingStream<String, Error>` for AI; `SFSpeechAudioBufferRecognitionRequest` for Apple Speech
- **Central orchestrator**: `PopoverViewModel` coordinates recording → VAD → AI → insertion
- **Persistence**: `HistoryStore` (SQLite), `SettingsStore` (UserDefaults), `KeychainManager` (Keychain)
- **UI**: SwiftUI in `Sources/UI/`, `@ObservedObject` on `PopoverViewModel`

### Build / test / commit

```bash
cd OpenType
swift build              # debug
swift build -c release   # release
swift test               # 14 test files in OpenTypeTests
```

Commits use Conventional Commits: `feat(scope): description`. Chinese OR English body acceptable.

---

## 5. Parallel Task Graph — Waves

```
Wave 1 (v0.9.1, executable now):
  A1 → A2 → A3 (sequential — share PopoverViewModel.swift / StyleProfileService.swift)
  A4 in parallel (no overlap)

Wave 2 (v1.0.0):
  B1 → B2 (sequential — share TranscriptionProvider protocol)
  B3 in parallel after A1 (uses preset infrastructure)

Wave 3 (v1.1.0):
  C1 (must come first)
  C2 → C3 (or in parallel after C1)

Wave 4 (v1.2.0+):
  D1 (depends on A3 pattern)
  D2, D3, D4 independent
```

---

## 6. Wave 1 — Execution Strategy

Branch `wave1-quick-wins` is the working branch.

- A4 runs in **background** (no file overlap with A1/A2/A3)
- A2 → A1 → A3 run **sequentially** to avoid edit conflicts on shared files (`PopoverViewModel.swift`, `StyleProfileService.swift`)

Atomic commit strategy (one per task, deferred to user review):
- `feat(presets): add built-in prompt library` (A1)
- `feat(ui): add cancel button during AI processing` (A2)
- `feat(profiles): per-app style profile auto-switch` (A3)
- `feat(dictionary): import dictionary terms from documents` (A4)

Each must pass `swift build && swift test` before being committed.

---

*Generated 2026-05-27 via plan agent (Prometheus). Replaces v0.8.0-era plan.*
