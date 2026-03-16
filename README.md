# OpenType 🎙️

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

> 🖼️ Screenshots coming soon! 
>
> *Main transcription interface with before/after comparison*
>
> *Provider configuration and voice input mode settings*

---


### 🔧 System Diagnostics

Built-in diagnostics panel to check system health:
- **Permission Status** - Verify microphone, accessibility, and automation permissions
- **Dependency Check** - Confirm ffmpeg, whisper.cpp, and model availability
- **Real-time Monitoring** - Continuous status updates with one-click fixes

### 🎛️ Audio Device Selection

Choose your preferred microphone input:
- **Device Detection** - Automatically lists all available audio input devices
- **Persistent Selection** - Remember your preferred device across sessions
- **Graceful Fallback** - Falls back to default device if selected device is unavailable

### 🔐 Secure API Key Storage

Enhanced security for your API keys:
- **macOS Keychain Integration** - API keys stored securely using electron.safeStorage
- **Automatic Migration** - Seamlessly migrates existing keys from plaintext to secure storage
- **Keychain Indicator** - Visual confirmation when keys are stored securely

### 👤 Per-App Dictation Profiles *(Coming Soon)*

Configure different settings for different applications:
- **App Detection** - Automatically detects foreground application
- **Profile Assignment** - Link profiles to specific apps (e.g., Slack, VS Code, Safari)
- **Custom Settings per App** - Different languages, providers, and AI processing per app

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

OpenType follows a versioned release strategy. Below is our planned roadmap from the current foundation through future platform expansion.

### ✅ v0.1.x Foundation (Completed)

**Goal**: Build the OpenType core prototype with basic voice input and AI post-processing capabilities.

- [x] 🎙️ **Core Voice Input** - Basic dictation functionality with global hotkey support
- [x] 🔄 **4 Voice Input Modes** - Four input modes: Basic, Hands-Free, Translate, Edit
- [x] 🔌 **Multi-Provider Support** - Integration with 7+ AI providers for post-processing
- [x] 💻 **Local Transcription** - whisper.cpp integration for offline transcription
- [x] 🤖 **AI Post-Processing** - Automatic filler word removal and intelligent text enhancement
- [x] 🔔 **Visual Feedback** - Tray icon status indicators and system notifications
- [x] ⌨️ **Hold-to-Speak** - Fixed simultaneous shortcut handling logic

### ✅ v0.2 Core Experience (Completed)

**Goal**: Evolve OpenType from "usable prototype" to "daily driver for Chinese users".

- [x] 🎙️ Integrate Alibaba Cloud ASR for Chinese speech recognition
- [x] ⚙️ Support provider-level configuration, connectivity testing, error prompts, and fallback logic
- [x] ✨ Enhanced intelligent punctuation completion (restore Chinese/English punctuation in AI post-processing pipeline)
- [x] 💾 Add data export and cleanup (export history, dictionary, config; one-click clear local history and cache)
- [x] 🛡️ Improve error feedback and permission guidance

**Success criteria:** ✅ Chinese users can achieve stable transcription without local whisper.cpp; default output readability significantly improved; users can clearly manage local data

### 🚀 v0.3 Productivity Features

**Goal**: Transform OpenType from "voice input" to "voice editing tool".

- [ ] 🎤 Voice command recognition (support commands like "new line", "delete last sentence", "undo", "add heading", "translate to English"; distinguish between "input content" and "editing commands")
- [ ] 🌐 Extended multilingual translation mode (beyond Chinese-to-English; support more language pairs such as Chinese-Japanese, Chinese-Korean, English-Chinese)
- [ ] 📚 Enhanced custom dictionary (batch import/export, categorized management of professional terms and proper nouns)
- [ ] 🗂️ Local model/cache management optimization (clearer display of model status, size, path, and deletable items)

**Success criteria:** High-frequency text editing scenarios can be completed via voice; translation mode becomes a standalone usable feature; dictionary and model management no longer require manual operations

### ⚡ v0.4 Performance and Streaming

**Goal**: Improve real-time performance and long-running experience.

- [ ] 📡 WebSocket/streaming transcription support (cloud providers support real-time results while speaking, optimized intermediate state and incremental display)
- [ ] 💾 Electron memory and background residency optimization (reduce long-running resource usage, optimize window hiding, tray residency, and duplicate startup behavior)
- [ ] 🚀 Startup speed optimization (reduce cold start check time, lazy-load non-critical modules)

**Success criteria:** Significantly reduced wait time from recording end to text appearance; more stable long-running application residency; faster first launch and invocation

### 🌐 v0.5 Platform and Extensibility

**Goal**: Evaluate and expand product boundaries.

- [ ] 🪟 Evaluate Windows support (validate global hotkeys, text insertion, permission models)
- [ ] 🐧 Evaluate Linux support (proceed only if stable in major desktop environments)
- [ ] 🔌 Design lightweight plugin extension points (text post-processing plugins, custom provider adapter layer)
- [ ] ⚡ Explore automation integration (evaluate macOS Shortcuts integration)

**Success criteria:** Clear understanding of whether cross-platform is worth continued investment; extension capabilities have clear boundaries without compromising core stability

### 🔮 Longer Term

Future vision items we hope to explore beyond the immediate roadmap:

- [ ] 🤖 Offline AI post-processing
- [ ] 🔒 Stronger privacy controls and sensitive information handling
- [ ] 👥 Team/enterprise capabilities
- [ ] 💼 Commercialization exploration
- [ ] 🎨 Community ecosystem and theming system

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/G3niusYukki/OpenType/issues)
- **Discussions**: [GitHub Discussions](https://github.com/G3niusYukki/OpenType/discussions)
- **Email**: [Open an issue](https://github.com/G3niusYukki/OpenType/issues/new)

---

<p align="center">
  Made with ❤️ by the OpenType community
</p>
