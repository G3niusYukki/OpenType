# OpenType Agent

A native PyObjC-based menu bar companion for OpenType on macOS.

## Features

- **Native Menu Bar Integration** - Lives in your macOS menu bar, always accessible
- **Server Management** - Start, stop, and restart OpenType directly from the menu bar
- **Persistent Statistics** - Track transcription time, word count, and sessions across reboots
- **Crash Recovery** - Automatic restart with exponential backoff on server crashes
- **Auto-Updates** - Check for and install updates from GitHub releases
- **LaunchAgent Support** - Auto-start on login with native macOS integration

## Requirements

- macOS 11.0 (Big Sur) or later
- Python 3.9 or later
- PyObjC framework

## Installation

### From Source

```bash
# Install dependencies
cd agent
pip3 install -r requirements.txt
pip3 install py2app

# Build the app
python3 setup.py py2app

# Copy to Applications
cp -r dist/OpenTypeAgent.app /Applications/
```

### Using npm scripts (from project root)

```bash
# Build agent
npm run build:agent

# Build and create DMG
npm run dist:agent
```

## Usage

1. **Launch** OpenTypeAgent from your Applications folder
2. **Click** the microphone icon in your menu bar to access controls
3. **Select** "Start Server" to launch OpenType
4. **Enable** "Start on Login" in preferences to auto-start

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│  OpenTypeAgent.app  │ ◄─────► │   OpenType.app      │
│   (PyObjC Menu Bar) │  HTTP   │   (Electron)        │
└─────────────────────┘         └─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   SQLite Database   │
│  (stats.db)         │
└─────────────────────┘
```

### Communication

The agent communicates with OpenType via:
- **HTTP API** (port 37421) - Real-time status and session events
- **Status File** (`~/status.json`) - Fallback file-based communication

### Components

- **app.py** - Main application delegate and lifecycle
- **status_bar.py** - Menu bar UI controller
- **server_manager.py** - OpenType process management
- **stats_service.py** - SQLite statistics storage
- **crash_monitor.py** - Crash detection and auto-restart
- **auto_updater.py** - GitHub releases integration
- **launch_agent.py** - macOS LaunchAgent control

## Data Storage

All data is stored in `~/Library/Application Support/OpenTypeAgent/`:

- `stats.db` - SQLite database with sessions, daily stats, and crash records
- `status.json` - Current server status
- `server.pid` - OpenType process ID
- `sessions.log` - Session event log

## Development

### Running in Development Mode

```bash
cd agent
python3 -m OpenTypeAgent
```

Or from project root:

```bash
npm run agent:dev
```

### Project Structure

```
agent/
├── OpenTypeAgent/
│   ├── __init__.py
│   ├── __main__.py          # Entry point
│   ├── app.py               # App delegate
│   ├── status_bar.py        # Menu bar UI
│   ├── server_manager.py    # Server lifecycle
│   ├── stats_service.py     # Statistics storage
│   ├── crash_monitor.py     # Crash recovery
│   ├── auto_updater.py      # Auto-updater
│   ├── launch_agent.py      # LaunchAgent control
│   └── constants.py         # Configuration
├── resources/
│   ├── IconTemplate.svg     # Menu bar icon
│   ├── IconRunning.svg      # Running state
│   └── IconError.svg        # Error state
├── requirements.txt
├── setup.py                 # py2app configuration
└── README.md
```

## License

MIT License - See [LICENSE](../LICENSE) for details
