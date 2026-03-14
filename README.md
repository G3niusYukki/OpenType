# OpenType

<p align="center">
  <img src="resources/icon.png" alt="OpenType Logo" width="120" height="120">
</p>

<p align="center">
  <strong>AI-Powered Voice-to-Text for macOS</strong><br>
  Type with your voice. Anywhere. Anytime.
</p>

<p align="center">
  <a href="https://github.com/G3niusYukki/OpenType/releases"><img src="https://img.shields.io/github/v/release/G3niusYukki/OpenType?include_prereleases&color=blue" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg" alt="Platform">
  <img src="https://img.shields.io/badge/Electron-36+-9fe2bf.svg" alt="Electron">
  <img src="https://img.shields.io/badge/React-19-61dafb.svg" alt="React">
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#development">Development</a>
</p>

---

## 🌟 Features

### 🎙️ Four Voice Input Modes

OpenType provides four distinct ways to interact with voice input:

| Mode | Shortcut | Description |
|------|----------|-------------|
| **Basic Voice Input** | `Cmd+Shift+D` | Hold to speak, release to send. Automatically removes filler words. |
| **Hands-Free Mode** | `Cmd+Space` | Toggle continuous recording. Press again to stop. |
| **Translate to English** | `Cmd+Shift+T` | Speak in Chinese, get structured English output. |
| **Edit Selected Text** | `Cmd+Shift+E` | Select text, speak commands like "translate" or "make it formal". |

### 🤖 AI-Powered Processing

- **Filler Word Removal** - Automatically removes "um", "uh", "嗯", "啊"
- **Repetition Removal** - "你好你好" → "你好"
- **Self-Correction Detection** - Keeps only the final version when you correct yourself
- **AI Post-Processing** - Optional text polishing and improvement

### 🔌 Multi-Provider Support

#### Transcription Providers (Audio → Text)
- **Local** - [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (offline, private)
- **OpenAI** - Whisper API (fast, accurate)
- **Groq** - Ultra-fast Whisper inference
- **阿里云** - Chinese ASR (coming soon)
- **腾讯云** - Chinese ASR (coming soon)
- **百度** - Chinese ASR (coming soon)
- **科大讯飞** - Chinese ASR (coming soon)

#### AI Post-Processing Providers (Text Enhancement)
- **OpenAI** - GPT-4o, GPT-4o-mini
- **Anthropic** - Claude 3.5 Sonnet, Claude 3 Opus
- **DeepSeek** - DeepSeek Chat
- **智谱 GLM** - GLM-4 series
- **MiniMax** - abab6.5
- **Moonshot (Kimi)** - Moonshot-v1
- **Groq** - Llama 3.1, Mixtral

### ⚡ Smart System Integration

- **Global Hotkeys** - Works from any app
- **Smart Text Insertion** - Pastes at cursor using native AppleScript
- **Menu Bar Tray** - Always accessible from the menu bar
- **Clipboard Fallback** - If paste fails, text is copied to clipboard
- **Transcription History** - Browse and manage past recordings

### 🛡️ Privacy-First Design

- **BYOK (Bring Your Own Key)** - Use your own API keys
- **Local-First** - Offline transcription with whisper.cpp
- **No Data Collection** - Your voice never leaves your machine (with local mode)

---

## 📸 Screenshots

<p align="center">
  <img src="resources/screenshot-home.png" alt="Home Screen" width="600">
  <br>
  <em>Main transcription interface with before/after comparison</em>
</p>

<p align="center">
  <img src="resources/screenshot-settings.png" alt="Settings" width="600">
  <br>
  <em>Provider configuration and voice input mode settings</em>
</p>

---

## 🚀 Installation

### Requirements

- **macOS 11+** (Big Sur or later)
- **Node.js 18+** (for development)
- **ffmpeg** (required for audio recording)

### Quick Install (Binary)

Download the latest release from [Releases](https://github.com/G3niusYukki/OpenType/releases):

```bash
# Download and install
curl -L -o OpenType.dmg https://github.com/G3niusYukki/OpenType/releases/latest/download/OpenType.dmg
open OpenType.dmg
```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/G3niusYukki/OpenType.git
cd OpenType

# Install dependencies
npm install

# Install ffmpeg (required)
brew install ffmpeg

# Optional: Install whisper.cpp for local transcription
brew install whisper.cpp

# Download Whisper model (for local transcription)
mkdir -p "~/Library/Application Support/OpenType/models"
curl -L -o "~/Library/Application Support/OpenType/models/ggml-base.bin" \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"

# Run in development mode
npm run dev

# Build for production
npm run build
npm run dist:mac
```

---

## 🎯 Usage

### First Launch

1. **Launch OpenType** - It will appear in your menu bar
2. **Grant Permissions** - You'll be prompted for:
   - **Microphone** - Required for recording
   - **Accessibility** - Required for global hotkeys and text insertion
   - **Automation** - Required for AppleScript text insertion
3. **Configure Provider** - Open Settings and add your API key or set up local transcription

### Voice Input Modes

#### Basic Voice Input (`Cmd+Shift+D`)

1. Hold `Cmd+Shift+D`
2. Speak naturally
3. Release to stop recording
4. Text is automatically inserted at your cursor

#### Hands-Free Mode (`Cmd+Space`)

1. Press `Cmd+Space` to start recording
2. Speak continuously
3. Press `Cmd+Space` again to stop
4. Text is processed and inserted

#### Translate to English (`Cmd+Shift+T`)

1. Press `Cmd+Shift+T`
2. Speak in Chinese
3. Release or press again to stop
4. English translation is inserted

#### Edit Selected Text (`Cmd+Shift+E`)

1. Select text in any app
2. Press `Cmd+Shift+E`
3. Speak your command:
   - "翻译成英文" → Translate to English
   - "正式一点" → Make it formal
   - "加个标题" → Add a title
   - "总结这段内容" → Summarize this
4. Edited text replaces the selection

### Custom Dictionary

Add custom word replacements for technical terms:

1. Open Settings → Dictionary
2. Add entries like:
   - `ASR` → `Automatic Speech Recognition`
   - `whisper` → `Whisper (OpenAI's speech model)`

---

## ⚙️ Configuration

### Voice Input Mode Toggles

Enable or disable individual voice input modes in Settings:

- **Basic Voice Input** - On/Off
- **Hands-Free Mode** - On/Off
- **Translate to English** - On/Off
- **Edit Selected Text** - On/Off

### AI Post-Processing Options

Configure text enhancement:

- **Remove Filler Words** - Remove "um", "uh", etc.
- **Remove Repetition** - Remove repeated words
- **Detect Self-Correction** - Apply speaker corrections
- **Show Comparison** - Display before/after in results

### Provider Configuration

#### Local Transcription (Free, Offline)

1. Install whisper.cpp: `brew install whisper.cpp`
2. Download a model (see Installation)
3. Select "Local" in transcription provider settings

#### OpenAI Cloud (Pay-per-use)

1. Get API key from [OpenAI](https://platform.openai.com/api-keys)
2. Add key in Settings → Transcription Providers → OpenAI
3. Select "OpenAI" in preferred provider

#### AI Post-Processing

1. Configure any supported AI provider (DeepSeek, OpenAI, etc.)
2. Enable "AI Post-Processing" in settings
3. Select processing options

---

## 🏗️ Architecture

```
OpenType/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── main.ts              # Entry point, lifecycle
│   │   ├── store.ts             # Configuration persistence
│   │   ├── audio-capture.ts     # Microphone recording (ffmpeg)
│   │   ├── transcription.ts     # ASR (whisper.cpp / cloud APIs)
│   │   ├── aiPostProcessor.ts   # AI text enhancement
│   │   ├── text-inserter.ts     # macOS text insertion
│   │   └── providers.ts         # Provider management
│   ├── preload/                 # Electron preload
│   │   └── preload.ts           # Secure IPC bridge
│   └── renderer/                # React frontend
│       ├── pages/
│       │   ├── HomePage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── HistoryPage.tsx
│       │   └── DictionaryPage.tsx
│       └── components/
├── resources/                   # Icons, entitlements
└── dist/                        # Build output
```

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Hotkey    │────▶│   Record    │────▶│  Audio File     │
│   Pressed   │     │  (ffmpeg)   │     │  (.wav)         │
└─────────────┘     └─────────────┘     └────────┬────────┘
                                                  │
                       ┌──────────────────────────┘
                       ▼
              ┌─────────────────┐
              │  Transcription  │
              │ (whisper.cpp /  │
              │  Cloud API)     │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  Translation │ │  Post-   │ │   Edit       │
│   (CN→EN)    │ │Processing│ │   Mode       │
└──────────────┘ └────┬─────┘ └──────────────┘
                      │
                      ▼
              ┌─────────────┐
              │   Insert    │
              │(AppleScript)│
              └─────────────┘
```

---

## 🛠️ Development

### Tech Stack

- **Electron 36+** - Desktop framework
- **React 19** - UI library
- **TypeScript 5.8+** - Type safety
- **Vite** - Build tool
- **Zustand** - State management
- **Lucide React** - Icons
- **electron-store** - Persistence

### Scripts

```bash
# Development
npm run dev              # Start dev mode (hot reload)
npm run dev:main         # Watch main process
npm run dev:renderer     # Start Vite dev server
npm run dev:preload      # Watch preload script

# Building
npm run build            # Build all
npm run build:main       # Build main process
npm run build:preload    # Build preload script
npm run build:renderer   # Build renderer

# Distribution
npm run dist             # Build distributables
npm run dist:mac         # Build for macOS

# Utilities
npm run kill             # Kill running instance
npm run restart          # Kill, build, restart
npm run typecheck        # Type check all
```

### Project Structure

```
src/
├── main/              # Electron main process (Node.js)
├── preload/           # Preload script (secure bridge)
└── renderer/          # React frontend (Chromium)
    ├── pages/         # Route-level pages
    ├── components/    # Reusable components
    └── i18n/          # Internationalization
```

---

## 🔒 Privacy & Security

### Data Handling

- **Voice Data**: Only stored locally during processing, deleted after transcription
- **API Keys**: Stored in macOS Keychain via electron-store
- **Transcription History**: Stored locally in `~/Library/Application Support/OpenType/`
- **No Telemetry**: No usage data sent to developers

### Permissions

OpenType requires these macOS permissions:

| Permission | Purpose | Settings Path |
|------------|---------|---------------|
| **Microphone** | Record your voice | System Settings → Privacy & Security → Microphone |
| **Accessibility** | Global hotkeys, text insertion | System Settings → Privacy & Security → Accessibility |
| **Automation** | AppleScript text insertion | System Settings → Privacy & Security → Automation |

---

## 🐛 Troubleshooting

### "Failed to start audio capture"

**Cause**: Microphone permission not granted

**Solution**:
1. Go to System Settings → Privacy & Security → Microphone
2. Enable OpenType
3. Restart the app

### "ffmpeg not found"

```bash
brew install ffmpeg
```

### "Whisper model not found"

```bash
mkdir -p "~/Library/Application Support/OpenType/models"
curl -L -o "~/Library/Application Support/OpenType/models/ggml-base.bin" \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
```

### "No transcription provider configured"

Either:
1. Install whisper.cpp + model (see above), OR
2. Add OpenAI/Groq API key in Settings

### Text doesn't paste

1. Check Accessibility permission
2. Check Automation permission (System Events)
3. Try manually pasting (Cmd+V) - text is always copied to clipboard

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/OpenType.git
cd OpenType

# Install dependencies
npm install

# Create branch
git checkout -b feature/amazing-feature

# Make changes, commit, push
git commit -m "Add amazing feature"
git push origin feature/amazing-feature

# Open Pull Request
```

---

## 📜 License

[MIT License](LICENSE) © 2024 OpenType Contributors

---

## 🙏 Acknowledgments

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Port of OpenAI's Whisper
- [OpenAI Whisper](https://github.com/openai/whisper) - Speech recognition model
- [Electron](https://www.electronjs.org/) - Desktop framework
- [React](https://react.dev/) - UI library
- Inspired by [TypeLess](https://typeless.app/) and similar dictation tools

---

## 🗺️ Roadmap

### ✅ Completed (v0.1.0 - v0.1.1)

- [x] **Core Voice Input** - Basic dictation with global hotkey
- [x] **4 Voice Input Modes** - Basic, Hands-free, Translate, Edit
- [x] **Multi-Provider Support** - 7+ AI providers for post-processing
- [x] **Local Transcription** - whisper.cpp integration
- [x] **AI Post-Processing** - Filler word removal, text enhancement
- [x] **Visual Feedback** - Tray icon states, notifications
- [x] **Hold-to-Speak** - Fixed simultaneous shortcut handling

### 🚧 In Progress

- [ ] **Chinese Cloud ASR** - 阿里云, 腾讯云, 百度, 科大讯飞 integration
- [ ] **Keyboard Shortcut Customization** - User-defined hotkeys in UI
- [ ] **API Key Encryption** - Secure storage using macOS Keychain

### 📋 Planned

- [ ] **Windows Support** - Cross-platform compatibility
- [ ] **Real-time Transcription** - Streaming ASR for instant feedback
- [ ] **Voice Commands** - "New paragraph", "Delete last word", etc.
- [ ] **Custom AI Prompts** - User-defined post-processing templates
- [ ] **Audio Device Selection** - Choose input source in settings
- [ ] **Session History Export** - Export transcriptions to various formats

### 💡 Ideas

- [ ] **Voice Profiles** - Per-app dictation profiles
- [ ] **Collaborative Editing** - Share and edit transcriptions
- [ ] **Plugin System** - Third-party extensions

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/G3niusYukki/OpenType/issues)
- **Discussions**: [GitHub Discussions](https://github.com/G3niusYukki/OpenType/discussions)
- **Email**: [Open an issue](https://github.com/G3niusYukki/OpenType/issues/new)

---

<p align="center">
  Made with ❤️ by the OpenType community
</p>
