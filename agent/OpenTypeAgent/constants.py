"""
Constants and configuration for OpenType Agent
"""

import os
from pathlib import Path

# Version
VERSION = "0.1.0"
APP_NAME = "OpenTypeAgent"
BUNDLE_ID = "com.opentype.agent"

# Paths
HOME = Path.home()
LIBRARY = HOME / "Library"
APPLICATION_SUPPORT = LIBRARY / "Application Support" / "OpenTypeAgent"
LOGS_DIR = LIBRARY / "Logs" / "OpenTypeAgent"
LAUNCH_AGENTS_DIR = LIBRARY / "LaunchAgents"

# Files
PID_FILE = APPLICATION_SUPPORT / "server.pid"
STATUS_FILE = APPLICATION_SUPPORT / "status.json"
DB_FILE = APPLICATION_SUPPORT / "stats.db"
LOG_FILE = LOGS_DIR / "agent.log"
LAUNCH_AGENT_PLIST = LAUNCH_AGENTS_DIR / "com.opentype.agent.plist"

# OpenType paths
OPENTYPE_BUNDLE_ID = "com.opentype.app"
OPENTYPE_APP_NAME = "OpenType.app"

# Default OpenType locations (in order of preference)
OPENTYPE_SEARCH_PATHS = [
    Path("/Applications/OpenType.app"),
    HOME / "Applications/OpenType.app",
    Path("/System/Applications/OpenType.app"),
]

# Server configuration
SERVER_START_TIMEOUT = 10  # seconds to wait for server to start
SERVER_STOP_TIMEOUT = 5    # seconds to wait for graceful shutdown
SERVER_POLL_INTERVAL = 1.0  # seconds between status checks

# Crash recovery
MAX_CRASHES = 5
CRASH_WINDOW_SECONDS = 300  # 5 minutes
BACKOFF_BASE_SECONDS = 2
BACKOFF_MAX_SECONDS = 60

# Auto-updater
GITHUB_REPO = "G3niusYukki/OpenType"
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
UPDATE_CHECK_INTERVAL = 86400  # 24 hours in seconds

# HTTP communication
AGENT_HTTP_PORT = 37420  # "Type" on phone keypad
ELECTRON_HTTP_PORT = 37421
HTTP_TIMEOUT = 5

# Status values
class ServerStatus:
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    ERROR = "error"
    CRASH_LOOP = "crash_loop"

# Ensure directories exist
def ensure_directories():
    """Create necessary directories if they don't exist"""
    APPLICATION_SUPPORT.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
