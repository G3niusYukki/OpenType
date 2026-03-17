"""
Logging utility for OpenType Agent
Provides file-based logging with rotation
"""

import os
import gzip
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
import threading


class RotatingLogger:
    """Simple rotating file logger"""

    def __init__(self, log_dir: Path, max_bytes: int = 10 * 1024 * 1024, backup_count: int = 5):
        """
        Initialize rotating logger

        Args:
            log_dir: Directory for log files
            max_bytes: Maximum size of log file before rotation (default 10MB)
            backup_count: Number of backup files to keep
        """
        self.log_dir = log_dir
        self.max_bytes = max_bytes
        self.backup_count = backup_count
        self.log_file = log_dir / "agent.log"
        self._lock = threading.Lock()

        # Ensure log directory exists
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def _should_rotate(self) -> bool:
        """Check if log file should be rotated"""
        if not self.log_file.exists():
            return False
        return self.log_file.stat().st_size >= self.max_bytes

    def _rotate(self):
        """Rotate log files"""
        # Remove oldest backup if it exists
        oldest_backup = self.log_dir / f"agent.log.{self.backup_count}.gz"
        if oldest_backup.exists():
            oldest_backup.unlink()

        # Shift existing backups
        for i in range(self.backup_count - 1, 0, -1):
            src = self.log_dir / f"agent.log.{i}.gz"
            dst = self.log_dir / f"agent.log.{i + 1}.gz"
            if src.exists():
                shutil.move(str(src), str(dst))

        # Compress and move current log
        if self.log_file.exists():
            with open(self.log_file, 'rb') as f_in:
                with gzip.open(str(self.log_dir / "agent.log.1.gz"), 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            self.log_file.unlink()

    def log(self, level: str, message: str):
        """Write a log entry"""
        with self._lock:
            # Check rotation
            if self._should_rotate():
                self._rotate()

            # Write log entry
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            log_line = f"{timestamp} [{level:8}] {message}\n"

            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(log_line)

    def debug(self, message: str):
        """Log debug message"""
        self.log('DEBUG', message)

    def info(self, message: str):
        """Log info message"""
        self.log('INFO', message)

    def warning(self, message: str):
        """Log warning message"""
        self.log('WARNING', message)

    def error(self, message: str):
        """Log error message"""
        self.log('ERROR', message)

    def get_log_path(self) -> Path:
        """Get current log file path"""
        return self.log_file

    def get_recent_logs(self, lines: int = 100) -> list:
        """Get recent log lines"""
        if not self.log_file.exists():
            return []

        try:
            with open(self.log_file, 'r', encoding='utf-8') as f:
                all_lines = f.readlines()
                return all_lines[-lines:]
        except Exception:
            return []


# Global logger instance
_logger: Optional[RotatingLogger] = None


def init_logger(log_dir: Path, max_bytes: int = 10 * 1024 * 1024, backup_count: int = 5):
    """Initialize the global logger"""
    global _logger
    _logger = RotatingLogger(log_dir, max_bytes, backup_count)


def get_logger() -> RotatingLogger:
    """Get the global logger instance"""
    global _logger
    if _logger is None:
        raise RuntimeError("Logger not initialized. Call init_logger() first.")
    return _logger


def log(level: str, message: str):
    """Log a message using the global logger"""
    if _logger:
        _logger.log(level, message)


def debug(message: str):
    """Log debug message"""
    log('DEBUG', message)


def info(message: str):
    """Log info message"""
    log('INFO', message)


def warning(message: str):
    """Log warning message"""
    log('WARNING', message)


def error(message: str):
    """Log error message"""
    log('ERROR', message)
