# OpenType

A macOS-first dictation assistant built with Electron + React + TypeScript. OpenType provides seamless voice-to-text transcription with BYOK (Bring Your Own Key) AI provider support.

> Current status: early MVP scaffold. The app shell, tray flow, settings, history, dictionary, and text insertion path are implemented; real ASR/LLM integration is the next step.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)

## Features

- 🎙️ **One-click dictation** - Start recording with a global hotkey or tray click
- 🔑 **BYOK Providers** - Use your own API keys for OpenAI, Anthropic, Groq, or local models
- 📋 **Smart text insertion** - Pastes text at cursor using AppleScript (macOS native)
- 📝 **Transcription history** - Browse, copy, and manage past dictations
- 📖 **Custom dictionary** - Define custom word replacements for technical terms
- ⚡ **Global hotkey** - `Cmd+Shift+D` by default, fully customizable
- 🎯 **Tray integration** - Lives in your menu bar, always accessible

## Architecture

```
OpenType/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.ts     # Entry point, window/tray management
│   │   ├── store.ts    # electron-store persistence
│   │   ├── audio-capture.ts    # Mic recording (v1: stub)
│   │   ├── text-inserter.ts    # macOS clipboard paste
│   │   └── providers.ts        # AI provider management
│   ├── preload/        # Electron preload script
│   │   └── preload.ts  # Secure IPC bridge
│   └── renderer/       # React frontend
│       ├── components/ # UI components
│       ├── pages/      # Main views
│       └── stores/     # State management
├── resources/          # Icons, entitlements
└── dist/              # Build output
```

## Quick Start

### Prerequisites

- macOS 11+ (Big Sur or later)
- Node.js 18+
- npm or yarn

### Development

```bash
# Clone and install
git clone <repo>
cd OpenType
npm install

# Run in dev mode
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
2. Click the tray icon or press `Cmd+Shift+D` to dictate
3. Configure AI providers in Settings (BYOK)

### AI Providers

OpenType supports multiple transcription providers:

| Provider | Type | Setup |
|----------|------|-------|
| OpenAI | Cloud | Add API key |
| Anthropic | Cloud | Add API key |
| Groq | Cloud | Add API key |
| Local | Self-hosted | Set base URL (e.g., Ollama) |

### Permissions

OpenType requires these macOS permissions:

- **Microphone** - For audio recording
- **Accessibility** - For global hotkey capture
- **Automation** - For AppleScript text insertion

## v1 Scope

This MVP includes:

- ✅ Tray app with recording toggle
- ✅ Global hotkey (`Cmd+Shift+D`)
- ✅ Mic capture stub (audio path placeholder)
- ✅ Text insertion via clipboard + AppleScript
- ✅ Settings UI with hotkey/language configuration
- ✅ Provider configuration (BYOK)
- ✅ History list with persistence
- ✅ Custom dictionary storage

### Future Roadmap

- [ ] Actual ASR integration (Whisper, etc.)
- [ ] LLM post-processing (formatting, commands)
- [ ] Real-time transcription streaming
- [ ] Voice commands ("delete that", "new line")
- [ ] Windows/Linux support
- [ ] Audio playback in history

## Development Notes

### Audio Capture

v1 uses a stub implementation. To add real recording:

1. Option A: Use `node-mic` or `naudiodon` for native capture
2. Option B: Spawn `ffmpeg` or `sox` subprocess
3. Option C: Use `AVFoundation` via native module

```typescript
// Example: ffmpeg capture (macOS)
ffmpeg -f avfoundation -i ":0" -ar 16000 -ac 1 -c:a pcm_s16le output.wav
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
  hotkey: string;           // Global shortcut
  language: string;         // Transcription language
  autoPunctuation: boolean;
  providers: ProviderConfig[];
  history: HistoryItem[];
  dictionary: DictionaryEntry[];
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

## License

MIT License - see [LICENSE](LICENSE) file

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

## Acknowledgments

Built with inspiration from VoiceInk and similar dictation tools.
