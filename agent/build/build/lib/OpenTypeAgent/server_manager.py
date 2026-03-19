"""
Server manager for OpenType Agent
Handles starting, stopping, and monitoring the OpenType Electron process
"""

import Foundation
import AppKit
import objc
from Cocoa import NSTask, NSPipe, NSTimer, NSNotificationCenter
from Foundation import NSObject, NSUserDefaults, NSURL, NSBundle, NSLog
import os
import signal
import json

from .constants import (
    PID_FILE, STATUS_FILE, SERVER_STOP_TIMEOUT,
    SERVER_POLL_INTERVAL, ServerStatus, OPENTYPE_SEARCH_PATHS
)


class ServerManager(NSObject):
    """Manages the OpenType server process lifecycle"""

    def init(self):
        """Initialize the server manager"""
        self = objc.super(ServerManager, self).init()
        if self is None:
            return None

        self.delegate = None
        self.server_task = None
        self.status_timer = None
        self.current_status = ServerStatus.STOPPED
        self.server_path = None
        self.exit_code = 0

        # Find OpenType installation
        self._find_opentype()

        return self

    def set_delegate(self, delegate):
        """Set the delegate for status callbacks"""
        self.delegate = delegate

    def _find_opentype(self):
        """Find the OpenType.app installation"""
        # Check user preference first
        defaults = NSUserDefaults.standardUserDefaults()
        custom_path = defaults.stringForKey_("opentype_path")

        if custom_path:
            path = custom_path
            if os.path.exists(path):
                self.server_path = path
                return

        # Check standard locations
        for path in OPENTYPE_SEARCH_PATHS:
            if path.exists():
                self.server_path = str(path)
                return

        # Fallback: try to find in common locations
        self.server_path = None

    def _get_executable_path(self):
        """Get the path to the OpenType executable inside the app bundle"""
        if not self.server_path:
            return None

        # OpenType.app/Contents/MacOS/OpenType
        executable = os.path.join(
            self.server_path,
            "Contents", "MacOS", "OpenType"
        )

        if os.path.exists(executable):
            return executable

        return None

    # MARK: - Server Control

    def start_server(self):
        """Start the OpenType server"""
        if self.current_status == ServerStatus.RUNNING:
            return True

        if not self.server_path:
            self._notify_status(ServerStatus.ERROR, "OpenType.app not found")
            return False

        executable = self._get_executable_path()
        if not executable:
            self._notify_status(ServerStatus.ERROR, "OpenType executable not found")
            return False

        self._notify_status(ServerStatus.STARTING)

        try:
            # Create NSTask
            self.server_task = NSTask.alloc().init()
            self.server_task.setLaunchPath_(executable)

            # Capture output
            stdout_pipe = NSPipe.pipe()
            stderr_pipe = NSPipe.pipe()
            self.server_task.setStandardOutput_(stdout_pipe)
            self.server_task.setStandardError_(stderr_pipe)

            # Set up termination handler
            self.server_task.setTerminationHandler_(self._server_terminated)

            # Launch
            self.server_task.launch()

            # Save PID
            pid = self.server_task.processIdentifier()
            self._save_pid(pid)

            # Start status monitoring
            self._start_status_timer()

            NSLog(f"Started OpenType server with PID {pid}")
            return True

        except Exception as e:
            NSLog(f"Failed to start server: {e}")
            self._notify_status(ServerStatus.ERROR, str(e))
            return False

    def stop_server(self):
        """Stop the OpenType server gracefully"""
        if self.current_status == ServerStatus.STOPPED:
            return True

        if not self.server_task:
            return True

        self._notify_status(ServerStatus.STOPPING)

        try:
            pid = self.server_task.processIdentifier()

            # Try graceful termination first (SIGTERM)
            self.server_task.terminate()

            # Wait for graceful shutdown
            import time
            start_time = time.time()

            while (time.time() - start_time) < SERVER_STOP_TIMEOUT:
                if not self.server_task.isRunning():
                    break
                time.sleep(0.1)

            # Force kill if still running
            if self.server_task.isRunning():
                NSLog(f"Server didn't stop gracefully, force killing PID {pid}")
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass  # Process already dead

            self._cleanup_after_stop()
            return True

        except Exception as e:
            NSLog(f"Error stopping server: {e}")
            self._cleanup_after_stop()
            return False

    def restart_server(self):
        """Restart the OpenType server"""
        def do_restart():
            self.stop_server()
            # Wait a moment for cleanup
            import time
            time.sleep(1)
            self.start_server()

        # Run restart in background
        import threading
        threading.Thread(target=do_restart, daemon=True).start()

    def check_existing_server(self):
        """Check if OpenType is already running"""
        # Check PID file
        pid = self._read_pid()

        if pid:
            try:
                # Check if process exists
                os.kill(pid, 0)
                # Process exists - adopt it
                NSLog(f"Found existing OpenType server with PID {pid}")
                self._notify_status(ServerStatus.RUNNING)
                self._start_status_timer()
                return True
            except (OSError, ProcessLookupError):
                # Process doesn't exist - clean up stale PID
                self._remove_pid_file()

        # Also check by reading status file
        if STATUS_FILE.exists():
            try:
                with open(STATUS_FILE, 'r') as f:
                    status_data = json.load(f)
                    if status_data.get('status') == 'running':
                        pid = status_data.get('pid')
                        if pid:
                            try:
                                os.kill(pid, 0)
                                self._notify_status(ServerStatus.RUNNING)
                                self._start_status_timer()
                                return True
                            except (OSError, ProcessLookupError):
                                pass
            except (json.JSONDecodeError, IOError):
                pass

        return False

    # MARK: - Status Monitoring

    def _start_status_timer(self):
        """Start the status monitoring timer"""
        if self.status_timer:
            self.status_timer.invalidate()

        self.status_timer = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
            SERVER_POLL_INTERVAL,
            self,
            self._check_status,
            None,
            True
        )

    def _stop_status_timer(self):
        """Stop the status monitoring timer"""
        if self.status_timer:
            self.status_timer.invalidate()
            self.status_timer = None

    def _check_status(self):
        """Check the current server status"""
        if not self.server_task:
            return

        is_running = self.server_task.isRunning()

        if is_running:
            if self.current_status != ServerStatus.RUNNING:
                self._notify_status(ServerStatus.RUNNING)
                if self.delegate:
                    self.delegate.server_started()
        else:
            # Server stopped
            if self.current_status not in (ServerStatus.STOPPED, ServerStatus.ERROR):
                # Unexpected stop
                self._handle_unexpected_stop()

    def _server_terminated(self, task):
        """Called when the server task terminates"""
        self.exit_code = task.terminationStatus()
        NSLog(f"Server terminated with exit code {self.exit_code}")

        if self.exit_code != 0 and self.current_status != ServerStatus.STOPPING:
            # This was a crash
            self._notify_status(ServerStatus.ERROR, f"Crashed (exit code {self.exit_code})")
            if self.delegate:
                self.delegate.server_status_changed(ServerStatus.ERROR)

    def _handle_unexpected_stop(self):
        """Handle unexpected server stop"""
        self._cleanup_after_stop()

        if self.exit_code != 0:
            self._notify_status(ServerStatus.ERROR, f"Crashed (exit code {self.exit_code})")
            if self.delegate:
                self.delegate.server_status_changed(ServerStatus.ERROR)
        else:
            self._notify_status(ServerStatus.STOPPED)

    def _cleanup_after_stop(self):
        """Clean up after server stops"""
        self._stop_status_timer()
        self._remove_pid_file()
        self.server_task = None

        if self.current_status != ServerStatus.ERROR:
            self._notify_status(ServerStatus.STOPPED)

        if self.delegate:
            self.delegate.server_stopped()

    # MARK: - PID File Management

    def _save_pid(self, pid):
        """Save the server PID to file"""
        try:
            PID_FILE.write_text(str(pid))
        except IOError as e:
            NSLog(f"Failed to save PID file: {e}")

    def _read_pid(self):
        """Read the server PID from file"""
        try:
            if PID_FILE.exists():
                return int(PID_FILE.read_text().strip())
        except (IOError, ValueError) as e:
            NSLog(f"Failed to read PID file: {e}")
        return None

    def _remove_pid_file(self):
        """Remove the PID file"""
        try:
            if PID_FILE.exists():
                PID_FILE.unlink()
        except IOError as e:
            NSLog(f"Failed to remove PID file: {e}")

    # MARK: - Delegate Notification

    def _notify_status(self, status, message=None):
        """Notify delegate of status change"""
        self.current_status = status
        if self.delegate:
            self.delegate.server_status_changed(status, message)
