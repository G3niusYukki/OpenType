# OpenType v0.5.0 Release Notes

## 🎉 Major Improvements

### 🎙️ Core Pipeline Complete — All 4 Voice Modes Working

All four voice input modes are now fully functional with proper routing:

| Mode | Pipeline |
|------|----------|
| **Basic** | Record → Transcribe → Dictionary → AI Process → Insert |
| **Translate** | Record → Transcribe → Dictionary → AI Translate → Insert |
| **Edit Selected** | Get Selection → Record → Transcribe → AI Edit → Replace |
| **Hands-Free** | Toggle start/stop with proper state management |

### 🎙️ Streaming Transcription (Apple Speech)

Apple Speech provider now supports real-time streaming transcription via `AsyncThrowingStream`. See partial results appear as you speak instead of waiting for the recording to finish.

### 📚 Dictionary System Fully Integrated

Custom dictionary entries now apply to all transcriptions automatically. Longest-match-first replacement prevents partial-match issues.

### 👤 Profile System Active

Switching profiles now updates transcription and AI provider settings in real-time.

### 🔔 Notifications & Launch at Login

- Transcription completion notifications via UserNotifications
- SMAppService integration for auto-launch at login

### 🎨 Error Banner UI

Toast-style error messages with retry option for transcription failures, microphone permission issues, and API errors.

---

## 🐛 Bug Fixes

### Critical Fixes
- **LSUIElement** — Fixed to `true` for true menu bar app (no Dock icon)
- **Hands-Free Toggle** — Now correctly toggles recording on/off via status bar controller
- **Voice Mode Filtering** — Disabled modes are now hidden from popover and hotkeys are not registered
- **Hotkey Hot-Reload** — Changing hotkeys in Settings takes effect immediately (no restart needed)

### Quality Fixes
- **Audio Playback** — Replaced timer-based stop with `AVAudioPlayerDelegate` for reliable playback
- **App Termination** — Proper cleanup on exit: stops recording, cleans temp files, unregisters hotkeys
- **Temp File Cleanup** — Automatic cleanup of old recording files
- **Alibaba Cloud ASR** — Upgraded to ACS3-HMAC-SHA256 signature v3 with proper headers

---

## 📊 Technical Stats

| Metric | v0.4.0 | v0.5.0 |
|--------|--------|--------|
| Transcription Providers | 4 | 4 |
| AI Providers | 7 | 7 |
| Voice Modes (functional) | 1/4 | 4/4 ✅ |
| Unit Tests | 0 | 17 |
| Dictionary Integration | UI only | Fully wired ✅ |
| Profile Integration | UI only | Fully wired ✅ |
| Error Handling | print() only | Toast UI ✅ |

---

## 📝 What's New Since v0.4.0

### New Features
- **Core pipeline routing** — All 4 voice modes fully functional
- **Dictionary Service** — Real-time word replacement from user dictionary
- **Profile Service** — Profile switching updates provider settings
- **Error Banner UI** — Toast-style error display with retry
- **Notification Service** — Transcription completion notifications
- **Launch at Login** — SMAppService auto-launch
- **Streaming Transcription** — `AsyncThrowingStream` protocol + AppleSpeechProvider implementation
- **About Page** — Version info and links in Settings
- **Sparkle Update Feed** — SUFeedURL configured

### Bug Fixes
- Hands-free toggle via status bar controller
- Voice mode enable/disable filtering
- Hotkey hot-reload on settings change
- AVAudioPlayerDelegate for reliable audio playback
- App termination cleanup
- Temp file automatic cleanup
- Alibaba Cloud ASR ACS3-HMAC-SHA256 signature v3
- LSUIElement set to true

### Testing
- 17 unit tests (models, settings, dictionary, voice mode configs)

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
4. Select "Alibaba Cloud ASR" and enter credentials (separate ID and Secret fields)

---

## 📄 License

MIT License © 2024-2026 OpenType Contributors
