# OpenType

A macOS-first dictation assistant built with Electron + React + TypeScript. OpenType provides seamless voice-to-text transcription with BYOK (Bring Your Own Key) AI provider support.

> **Current status:** Working audio capture and transcription pipeline. Requires `ffmpeg` for recording and optionally `whisper.cpp` for local transcription, or an OpenAI API key for cloud transcription.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)

## Features

- 🎙️ **One-click dictation** - Start recording with a global hotkey or tray click
- 🔑 **BYOK Providers** - Use your own API keys for OpenAI, Anthropic, Groq, or local models
- 💻 **Local-first transcription** - Offline transcription with whisper.cpp (no cloud required)
- 📋 **Smart text insertion** - Pastes text at cursor using AppleScript (macOS native)
- 📝 **Transcription history** - Browse, copy, and manage past dictations
- 📖 **Custom dictionary** - Define custom word replacements for technical terms
- ⚡ **Global hotkey** - `Cmd+Shift+D` by default, fully customizable
- 🎯 **Tray integration** - Lives in your menu bar, always accessible

## Architecture

```
OpenType/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # Entry point, window/tray management
│   │   ├── store.ts          # electron-store persistence
│   │   ├── audio-capture.ts  # Mic recording via ffmpeg
│   │   ├── transcription.ts  # ASR (whisper.cpp / OpenAI)
│   │   ├── text-inserter.ts  # macOS clipboard paste
│   │   └── providers.ts      # AI provider management
│   ├── preload/              # Electron preload script
│   │   └── preload.ts        # Secure IPC bridge
│   └── renderer/             # React frontend
│       ├── components/       # UI components
│       ├── pages/            # Main views
│       └── stores/           # State management
├── resources/                # Icons, entitlements
└── dist/                     # Build output
```

## Quick Start

### Prerequisites

- **macOS 11+** (Big Sur or later)
- **Node.js 18+**
- **npm or yarn**
- **ffmpeg** (required for audio recording)

### macOS Setup

#### 1. Install ffmpeg

```bash
# Using Homebrew (recommended)
brew install ffmpeg

# Verify installation
ffmpeg -version
```

#### 2. Install whisper.cpp (optional - for local transcription)

```bash
# Using Homebrew
brew install whisper.cpp

# Verify installation
whisper-cpp --help
```

#### 3. Download a Whisper model (required for local transcription)

```bash
# Create models directory
mkdir -p "~/Library/Application Support/OpenType/models"

# Download base model (~74MB, good balance of speed/accuracy)
curl -L -o "~/Library/Application Support/OpenType/models/ggml-base.bin" \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"

# Or download a different size:
# tiny (~39MB) - fastest, less accurate
# small (~466MB) - slower, more accurate
# medium (~1.5GB) - slow, very accurate
# large (~3.1GB) - slowest, most accurate
```

Model sizes reference:
| Model | Size | RAM | Speed | Accuracy |
|-------|------|-----|-------|----------|
| tiny | 39 MB | ~273 MB | ⚡⚡⚡ | ⭐⭐ |
| base | 74 MB | ~442 MB | ⚡⚡ | ⭐⭐⭐ |
| small | 466 MB | ~965 MB | ⚡ | ⭐⭐⭐⭐ |
| medium | 1.5 GB | ~2.3 GB | 🐢 | ⭐⭐⭐⭐⭐ |
| large | 3.1 GB | ~4.2 GB | 🐢🐢 | ⭐⭐⭐⭐⭐ |

#### 4. Clone and install

```bash
git clone <repo>
cd OpenType
npm install
```

#### 5. Run in dev mode

```bash
npm run dev
```

### Build

```bash
# Build for macOS
npm run dist:mac

# Output: release/OpenType-0.1.0.dmg
```

## Configuration

### First-time Setup

1. Launch OpenType (it will appear in your menu bar)
2. Grant permissions when prompted (see Permissions section below)
3. Click the tray icon or press `Cmd+Shift+D` to dictate
4. Configure transcription provider in Settings:
   - **Local (free, offline)**: Install whisper.cpp + model
   - **OpenAI Cloud**: Add API key (pay-per-use)

### AI Providers

OpenType supports multiple transcription providers:

| Provider | Type | Speed | Privacy | Setup |
|----------|------|-------|---------|-------|
| whisper.cpp | Local | Medium | ✅ Offline only | Install whisper.cpp + download model |
| OpenAI | Cloud | Fast | ☁️ Sent to API | Add API key in settings |
| Anthropic | Cloud | N/A | ☁️ Text processing only | Configure for LLM post-processing |
| Groq | Cloud | Very Fast | ☁️ Sent to API | Add API key in settings |

### macOS Permissions

OpenType requires these macOS permissions. You'll be prompted on first use:

#### Microphone Access
**Required for:** Recording your voice

```bash
# Grant manually if needed
osascript -e 'tell application "System Events" to make login item at end with properties {path:"/Applications/OpenType.app", hidden:false}'
```

Settings path: **System Settings → Privacy & Security → Microphone → OpenType**

#### Accessibility Access
**Required for:** Global hotkey capture, text insertion

Settings path: **System Settings → Privacy & Security → Accessibility → OpenType**

#### Automation (Apple Events)
**Required for:** Pasting text at cursor position

Settings path: **System Settings → Privacy & Security → Automation → OpenType → System Events**

## Troubleshooting

### "Recording Error: ffmpeg not available"
```bash
# Install ffmpeg
brew install ffmpeg

# Verify
which ffmpeg
```

### "Transcription unavailable - No transcription provider"
Either:
1. Install whisper.cpp + model (see Setup step 2-3), OR
2. Add OpenAI API key in Settings

### "Whisper model not found"
```bash
# Check models directory
ls -la "~/Library/Application Support/OpenType/models/"

# Download base model
curl -L -o "~/Library/Application Support/OpenType/models/ggml-base.bin" \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
```

### Audio recording starts but no text appears
1. Check mic permissions in System Settings
2. Check console logs: `Console.app` → search "OpenType"
3. Try recording with ffmpeg directly:
   ```bash
   ffmpeg -f avfoundation -i ":0" -ar 16000 -ac 1 -c:a pcm_s16le ~/test.wav
   ```

### Text doesn't paste at cursor
1. Check Accessibility permission in System Settings
2. Check Automation permission (System Events)
3. Some apps don't support AppleScript paste - text is copied to clipboard instead

## Development

### Audio Capture

Uses ffmpeg with AVFoundation (macOS native audio framework):

```bash
# Equivalent command run internally:
ffmpeg -f avfoundation -i ":0" -ar 16000 -ac 1 -c:a pcm_s16le output.wav
```

- `-f avfoundation`: Use macOS AVFoundation framework
- `-i ":0"`: Default audio input device
- `-ar 16000`: 16kHz sample rate (optimal for Whisper)
- `-ac 1`: Mono audio
- `-c:a pcm_s16le`: 16-bit PCM WAV format

### Transcription Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Record    │ ──▶ │  Stop/Save  │ ──▶ │  Transcribe     │
│  (ffmpeg)   │     │  (.wav file)│     │ (whisper.cpp    │
└─────────────┘     └─────────────┘     │  or OpenAI API) │
                                        └────────┬────────┘
                                                 │
                    ┌─────────────┐              │
                    │   Insert    │ ◀────────────┘
                    │ (AppleScript)│
                    └─────────────┘
```

### Text Insertion

Primary method uses AppleScript for native paste:

```applescript
tell application "System Events"
  keystroke "v" using command down
end tell
```

Fallback: Copy to clipboard (user pastes manually)

### Store Schema

```typescript
{
  hotkey: string;              // Global shortcut
  language: string;            // Transcription language (default: en-US)
  autoPunctuation: boolean;    // Auto-add punctuation
  providers: ProviderConfig[]; // AI provider settings
  history: HistoryItem[];      // Transcription history
  dictionary: DictionaryEntry[]; // Custom word replacements
}
```

## Tech Stack

- **Electron** - Desktop app framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Zustand** - State management (ready)
- **electron-store** - Persistence
- **Lucide** - Icons
- **ffmpeg** - Audio capture (macOS AVFoundation)
- **whisper.cpp** - Local transcription

## Model Storage Locations

whisper.cpp looks for models in these locations (in order):

1. `~/Library/Application Support/OpenType/models/` (app-specific)
2. `/opt/homebrew/share/whisper.cpp/` (Homebrew default)
3. `/usr/local/share/whisper.cpp/` (Intel Mac Homebrew)
4. `~/.local/share/whisper.cpp/` (user local)

## License

MIT License - see [LICENSE](LICENSE) file

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

## Acknowledgments

Built with inspiration from VoiceInk and similar dictation tools.
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Port of OpenAI's Whisper
- [OpenAI Whisper](https://github.com/openai/whisper) - Speech recognition model
