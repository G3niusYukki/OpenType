"""
LaunchAgent controller for OpenType Agent
Manages macOS LaunchAgent registration for auto-start on login
"""

import Foundation
import AppKit
import objc
from Cocoa import NSTask, NSPipe
from Foundation import NSObject, NSUserDefaults, NSURL, NSLog
import os
import plistlib
from pathlib import Path

from .constants import LAUNCH_AGENT_PLIST, APP_NAME, BUNDLE_ID


class LaunchAgentController(NSObject):
    """Controls LaunchAgent registration for auto-start"""

    def init(self):
        """Initialize the launch agent controller"""
        self = objc.super(LaunchAgentController, self).init()
        if self is None:
            return None

        self.plist_path = LAUNCH_AGENT_PLIST
        self.agent_label = BUNDLE_ID

        return self

    def is_registered(self):
        """Check if the LaunchAgent is registered"""
        return self.plist_path.exists()

    def is_loaded(self):
        """Check if the LaunchAgent is currently loaded in launchctl"""
        try:
            task = NSTask.alloc().init()
            task.setLaunchPath_("/bin/launchctl")
            task.setArguments_(["list", self.agent_label])

            pipe = NSPipe.pipe()
            task.setStandardOutput_(pipe)
            task.setStandardError_(pipe)

            task.launch()
            task.waitUntilExit()

            return task.terminationStatus() == 0

        except Exception as e:
            NSLog(f"Failed to check launchctl status: {e}")
            return False

    def register(self):
        """Register as a LaunchAgent"""
        try:
            # Ensure parent directory exists
            self.plist_path.parent.mkdir(parents=True, exist_ok=True)

            # Get the path to the agent executable
            bundle_path = self._get_bundle_path()
            if not bundle_path:
                NSLog("Could not find agent bundle path")
                return False

            executable_path = os.path.join(
                bundle_path,
                "Contents", "MacOS", APP_NAME
            )

            # Create plist content
            plist_content = {
                "Label": self.agent_label,
                "ProgramArguments": [executable_path],
                "RunAtLoad": True,
                "KeepAlive": False,
                "ProcessType": "Background",
                "LowPriorityIO": True,
                "LowPriorityBackgroundIO": True,
                "StandardOutPath": str(Path.home() / "Library/Logs/OpenTypeAgent/launchagent.out.log"),
                "StandardErrorPath": str(Path.home() / "Library/Logs/OpenTypeAgent/launchagent.err.log"),
            }

            # Write plist
            with open(self.plist_path, 'wb') as f:
                plistlib.dump(plist_content, f)

            NSLog(f"Created LaunchAgent plist at {self.plist_path}")

            # Load the agent
            return self._load_agent()

        except Exception as e:
            NSLog(f"Failed to register LaunchAgent: {e}")
            return False

    def unregister(self):
        """Unregister the LaunchAgent"""
        try:
            # Unload first
            self._unload_agent()

            # Remove plist file
            if self.plist_path.exists():
                self.plist_path.unlink()
                NSLog(f"Removed LaunchAgent plist at {self.plist_path}")

            return True

        except Exception as e:
            NSLog(f"Failed to unregister LaunchAgent: {e}")
            return False

    def toggle(self):
        """Toggle LaunchAgent registration"""
        if self.is_registered():
            return self.unregister()
        else:
            return self.register()

    def _load_agent(self):
        """Load the agent with launchctl"""
        try:
            task = NSTask.alloc().init()
            task.setLaunchPath_("/bin/launchctl")
            task.setArguments_(["load", str(self.plist_path)])

            pipe = NSPipe.pipe()
            task.setStandardOutput_(pipe)
            task.setStandardError_(pipe)

            task.launch()
            task.waitUntilExit()

            if task.terminationStatus() == 0:
                NSLog("LaunchAgent loaded successfully")
                return True
            else:
                # Try bootstrap for user agents (macOS 10.10+)
                return self._bootstrap_agent()

        except Exception as e:
            NSLog(f"Failed to load LaunchAgent: {e}")
            return False

    def _unload_agent(self):
        """Unload the agent with launchctl"""
        try:
            task = NSTask.alloc().init()
            task.setLaunchPath_("/bin/launchctl")
            task.setArguments_(["unload", str(self.plist_path)])

            pipe = NSPipe.pipe()
            task.setStandardOutput_(pipe)
            task.setStandardError_(pipe)

            task.launch()
            task.waitUntilExit()

            if task.terminationStatus() == 0:
                NSLog("LaunchAgent unloaded successfully")
                return True
            else:
                # Try bootout for user agents (macOS 10.10+)
                return self._bootout_agent()

        except Exception as e:
            NSLog(f"Failed to unload LaunchAgent: {e}")
            return False

    def _bootstrap_agent(self):
        """Bootstrap the agent (modern macOS)"""
        try:
            task = NSTask.alloc().init()
            task.setLaunchPath_("/bin/launchctl")
            task.setArguments_(["bootstrap", "gui/" + str(os.getuid()), str(self.plist_path)])

            task.launch()
            task.waitUntilExit()

            success = task.terminationStatus() == 0
            if success:
                NSLog("LaunchAgent bootstrapped successfully")
            return success

        except Exception as e:
            NSLog(f"Failed to bootstrap LaunchAgent: {e}")
            return False

    def _bootout_agent(self):
        """Bootout the agent (modern macOS)"""
        try:
            task = NSTask.alloc().init()
            task.setLaunchPath_("/bin/launchctl")
            task.setArguments_(["bootout", "gui/" + str(os.getuid()), str(self.plist_path)])

            task.launch()
            task.waitUntilExit()

            success = task.terminationStatus() == 0
            if success:
                NSLog("LaunchAgent booted out successfully")
            return success

        except Exception as e:
            NSLog(f"Failed to bootout LaunchAgent: {e}")
            return False

    def _get_bundle_path(self):
        """Get the path to the agent bundle"""
        try:
            # Try to get from running bundle
            bundle = NSBundle.mainBundle()
            path = bundle.bundlePath()
            if path:
                return str(path)
        except:
            pass

        # Fallback to common locations
        possible_paths = [
            Path("/Applications/OpenTypeAgent.app"),
            Path.home() / "Applications/OpenTypeAgent.app",
        ]

        for path in possible_paths:
            if path.exists():
                return str(path)

        return None

    def get_status(self):
        """Get current LaunchAgent status"""
        return {
            'registered': self.is_registered(),
            'loaded': self.is_loaded(),
            'plist_path': str(self.plist_path),
        }
