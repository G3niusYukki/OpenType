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