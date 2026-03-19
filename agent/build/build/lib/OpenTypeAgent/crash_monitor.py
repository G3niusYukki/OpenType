"""
Crash monitor for OpenType Agent
Implements crash detection and auto-restart with exponential backoff
"""

import Foundation
import AppKit
import objc
from Foundation import NSObject, NSDate, NSLog
from datetime import datetime, timedelta

from .constants import MAX_CRASHES, CRASH_WINDOW_SECONDS, BACKOFF_BASE_SECONDS, BACKOFF_MAX_SECONDS


class CrashMonitor(NSObject):
    """Monitors server crashes and implements auto-restart logic"""

    def init(self):
        """Initialize the crash monitor"""
        self = objc.super(CrashMonitor, self).init()
        if self is None:
            return None

        self.crash_times = []  # List of crash timestamps
        self.last_reset_time = datetime.now()
        self.consecutive_crashes = 0

        return self

    def record_crash(self, exit_code=None):
        """Record a server crash"""
        now = datetime.now()
        self.crash_times.append({
            'timestamp': now,
            'exit_code': exit_code
        })
        self.consecutive_crashes += 1

        # Clean up old crashes outside the window
        self._clean_old_crashes()

        NSLog(f"Recorded crash #{self.consecutive_crashes} (exit code: {exit_code})")

    def _clean_old_crashes(self):
        """Remove crash records outside the monitoring window"""
        cutoff = datetime.now() - timedelta(seconds=CRASH_WINDOW_SECONDS)
        self.crash_times = [
            c for c in self.crash_times
            if c['timestamp'] > cutoff
        ]

    def should_auto_restart(self):
        """
        Determine if we should auto-restart based on crash history
        Returns True if crashes are below threshold, False otherwise
        """
        self._clean_old_crashes()

        if len(self.crash_times) >= MAX_CRASHES:
            NSLog(f"Crash threshold reached ({MAX_CRASHES} in {CRASH_WINDOW_SECONDS}s), stopping auto-restart")
            return False

        return True

    def get_backoff_delay(self):
        """
        Calculate the exponential backoff delay
        Returns delay in seconds
        """
        # Exponential backoff: 2^n with cap at 60 seconds
        delay = min(
            BACKOFF_BASE_SECONDS * (2 ** self.consecutive_crashes),
            BACKOFF_MAX_SECONDS
        )

        NSLog(f"Calculated backoff delay: {delay}s (crash #{self.consecutive_crashes})")
        return delay

    def reset(self):
        """Reset the crash counter after successful operation"""
        if self.consecutive_crashes > 0:
            NSLog(f"Resetting crash counter (was {self.consecutive_crashes})")
            self.consecutive_crashes = 0
            self.crash_times = []
            self.last_reset_time = datetime.now()

    def get_crash_count(self):
        """Get the number of crashes in the current window"""
        self._clean_old_crashes()
        return len(self.crash_times)

    def get_status(self):
        """Get current crash monitor status for display"""
        self._clean_old_crashes()

        return {
            'consecutive_crashes': self.consecutive_crashes,
            'recent_crashes': len(self.crash_times),
            'max_crashes': MAX_CRASHES,
            'can_restart': self.should_auto_restart(),
            'next_delay': self.get_backoff_delay() if self.should_auto_restart() else None,
        }
