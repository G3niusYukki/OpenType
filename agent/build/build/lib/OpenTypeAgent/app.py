"""
Main application delegate for OpenType Agent
Handles app lifecycle and coordinates all components
"""

import Foundation
import AppKit
import objc
from Cocoa import (
    NSApplication, NSApplicationDelegate,
    NSUserNotification, NSUserNotificationCenter,
    NSTimer, NSRunLoop, NSDate
)
from Foundation import NSObject, NSLog

from .constants import VERSION, APP_NAME, ensure_directories
from .logger import init_logger, get_logger, info, error
from .status_bar import StatusBarController
from .server_manager import ServerManager
from .stats_service import StatsService
from .crash_monitor import CrashMonitor
from .auto_updater import AutoUpdater
from .launch_agent import LaunchAgentController


class OpenTypeAgentApp(NSObject):
    """Main application controller"""

    def init(self):
        """Initialize the application"""
        self = objc.super(OpenTypeAgentApp, self).init()
        if self is None:
            return None

        self.status_bar = None
        self.server_manager = None
        self.stats_service = None
        self.crash_monitor = None
        self.auto_updater = None
        self.launch_agent = None
        self.update_timer = None

        return self

    def applicationDidFinishLaunching_(self, notification):
        """Called when the application has finished launching"""
        NSLog(f"OpenType Agent v{VERSION} starting...")

        # Ensure directories exist
        ensure_directories()

        # Initialize services
        self.stats_service = StatsService()
        self.stats_service.init_database()

        self.crash_monitor = CrashMonitor()

        self.launch_agent = LaunchAgentController()

        self.auto_updater = AutoUpdater()
        self.auto_updater.set_delegate(self)

        # Initialize server manager
        self.server_manager = ServerManager()
        self.server_manager.set_delegate(self)

        # Initialize status bar
        self.status_bar = StatusBarController()
        self.status_bar.set_delegate(self)
        self.status_bar.setup_menu()

        # Check for already running OpenType instance
        self.server_manager.check_existing_server()

        # Schedule automatic update check
        self.schedule_update_check()

        NSLog("OpenType Agent started successfully")

    def applicationWillTerminate_(self, notification):
        """Called when the application is about to terminate"""
        NSLog("OpenType Agent shutting down...")

        # Stop the server if it's running
        if self.server_manager:
            self.server_manager.stop_server()

        # Clean up
        if self.update_timer:
            self.update_timer.invalidate()

        NSLog("OpenType Agent shut down complete")

    # MARK: - StatusBarController Delegate Methods

    def start_server_requested(self):
        """User requested to start the server"""
        if self.server_manager:
            self.server_manager.start_server()

    def stop_server_requested(self):
        """User requested to stop the server"""
        if self.server_manager:
            self.server_manager.stop_server()

    def restart_server_requested(self):
        """User requested to restart the server"""
        if self.server_manager:
            self.server_manager.restart_server()

    def check_for_updates_requested(self):
        """User requested to check for updates"""
        if self.auto_updater:
            self.auto_updater.check_now()

    def toggle_launch_agent_requested(self):
        """User requested to toggle launch agent"""
        if self.launch_agent:
            self.launch_agent.toggle()
            self.status_bar.update_launch_agent_status(self.launch_agent.is_registered())

    def show_preferences_requested(self):
        """User requested to show preferences"""
        # TODO: Implement preferences window
        self.show_notification("Preferences", "Preferences window coming soon!")

    def show_statistics_requested(self):
        """User requested to show statistics"""
        if self.stats_service:
            stats = self.stats_service.get_statistics("all")
            self.status_bar.update_statistics(stats)

    def export_statistics_requested(self, format_type):
        """User requested to export statistics"""
        if self.stats_service:
            success = self.stats_service.export_statistics(format_type)
            if success:
                self.show_notification("Export Complete", f"Statistics exported as {format_type.upper()}")
            else:
                self.show_notification("Export Failed", "Could not export statistics")

    # MARK: - ServerManager Delegate Methods

    def server_status_changed(self, status, message=None):
        """Called when server status changes"""
        if self.status_bar:
            self.status_bar.update_server_status(status, message)

        # Handle crash detection
        if status == "error" and self.crash_monitor:
            self.handle_server_crash()

    def server_started(self):
        """Called when server has successfully started"""
        if self.crash_monitor:
            self.crash_monitor.reset()
        self.show_notification("OpenType Started", "Server is now running")

    def server_stopped(self):
        """Called when server has stopped"""
        pass

    def handle_server_crash(self):
        """Handle server crash with auto-restart logic"""
        if not self.crash_monitor:
            return

        self.crash_monitor.record_crash()

        if self.crash_monitor.should_auto_restart():
            delay = self.crash_monitor.get_backoff_delay()
            self.show_notification(
                "OpenType Crashed",
                f"Restarting in {delay} seconds..."
            )
            self.performSelector_withObject_afterDelay_(
                self.auto_restart_server,
                None,
                delay
            )
        else:
            self.show_notification(
                "OpenType Error",
                "Server crashed too many times. Please check the logs."
            )
            if self.status_bar:
                self.status_bar.update_server_status("crash_loop")

    def auto_restart_server(self):
        """Auto-restart the server after a crash"""
        if self.server_manager:
            self.server_manager.start_server()

    # MARK: - AutoUpdater Delegate Methods

    def update_available(self, version, download_url):
        """Called when an update is available"""
        self.show_notification(
            "Update Available",
            f"OpenType Agent {version} is available"
        )
        if self.status_bar:
            self.status_bar.show_update_available(version)

    def update_downloaded(self, version):
        """Called when an update has been downloaded"""
        self.show_notification(
            "Update Ready",
            f"OpenType Agent {version} will be installed on next launch"
        )

    # MARK: - Helper Methods

    def schedule_update_check(self):
        """Schedule periodic update checks"""
        from Foundation import NSTimer

        # Check immediately on startup
        if self.auto_updater:
            self.auto_updater.check_now()

        # Schedule daily checks
        self.update_timer = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
            86400,  # 24 hours
            self,
            self.check_for_updates,
            None,
            True
        )

    def check_for_updates(self):
        """Timer callback for update check"""
        if self.auto_updater:
            self.auto_updater.check_now()

    def show_notification(self, title, message):
        """Show a native macOS notification"""
        notification = NSUserNotification.alloc().init()
        notification.setTitle_(title)
        notification.setInformativeText_(message)
        notification.setSoundName_("NSUserNotificationDefaultSoundName")

        center = NSUserNotificationCenter.defaultUserNotificationCenter()
        center.deliverNotification_(notification)


def main():
    """Main entry point"""
    app = NSApplication.sharedApplication()
    delegate = OpenTypeAgentApp.alloc().init()
    app.setDelegate_(delegate)
    app.run()


if __name__ == "__main__":
    main()
