"""
Status bar controller for OpenType Agent
Manages the menu bar icon and dropdown menu
"""

import Foundation
import AppKit
import objc
from Cocoa import (
    NSStatusBar, NSStatusItem, NSMenu, NSMenuItem,
    NSImage, NSVariableStatusItemLength,
    NSFont, NSAttributedString
)
from Foundation import NSObject, NSBundle, NSURL

from .constants import VERSION, APP_NAME, ServerStatus


class StatusBarController(NSObject):
    """Controller for the menu bar status item"""

    # Status icon names (PDF files in resources)
    ICON_IDLE = "IconTemplate"
    ICON_RUNNING = "IconRunning"
    ICON_ERROR = "IconError"

    def init(self):
        """Initialize the status bar controller"""
        self = objc.super(StatusBarController, self).init()
        if self is None:
            return None

        self.status_item = None
        self.menu = None
        self.delegate = None

        # Menu items (kept as references for updating)
        self.status_menu_item = None
        self.start_menu_item = None
        self.stop_menu_item = None
        self.restart_menu_item = None
        self.statistics_menu = None
        self.update_menu_item = None
        self.launch_agent_menu_item = None

        self.current_status = ServerStatus.STOPPED
        self.update_available_version = None

        return self

    def set_delegate(self, delegate):
        """Set the delegate for action callbacks"""
        self.delegate = delegate

    def setup_menu(self):
        """Set up the status bar item and menu"""
        # Create status bar item
        status_bar = NSStatusBar.systemStatusBar()
        self.status_item = status_bar.statusItemWithLength_(NSVariableStatusItemLength)

        # Set initial icon
        self.set_icon(self.ICON_IDLE)

        # Create menu
        self.menu = NSMenu.alloc().init()
        self.menu.setAutoenablesItems_(False)

        # Build menu structure
        self._build_menu()

        # Attach menu to status item
        self.status_item.setMenu_(self.menu)

    def _build_menu(self):
        """Build the menu structure"""
        # Status header
        self.status_menu_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Status: Stopped", None, ""
        )
        self.status_menu_item.setEnabled_(False)
        self.menu.addItem_(self.status_menu_item)

        self.menu.addItem_(NSMenuItem.separatorItem())

        # Server controls
        self.start_menu_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Start Server", "startServer:", ""
        )
        self.start_menu_item.setTarget_(self)
        self.menu.addItem_(self.start_menu_item)

        self.stop_menu_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Stop Server", "stopServer:", ""
        )
        self.stop_menu_item.setTarget_(self)
        self.stop_menu_item.setEnabled_(False)
        self.menu.addItem_(self.stop_menu_item)

        self.restart_menu_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Restart Server", "restartServer:", ""
        )
        self.restart_menu_item.setTarget_(self)
        self.restart_menu_item.setEnabled_(False)
        self.menu.addItem_(self.restart_menu_item)

        self.menu.addItem_(NSMenuItem.separatorItem())

        # Statistics submenu
        stats_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Statistics", None, ""
        )
        self.statistics_menu = self._create_statistics_menu()
        stats_item.setSubmenu_(self.statistics_menu)
        self.menu.addItem_(stats_item)

        self.menu.addItem_(NSMenuItem.separatorItem())

        # Preferences submenu
        prefs_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Preferences", None, ""
        )
        prefs_menu = self._create_preferences_menu()
        prefs_item.setSubmenu_(prefs_menu)
        self.menu.addItem_(prefs_item)

        self.menu.addItem_(NSMenuItem.separatorItem())

        # Update check
        self.update_menu_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Check for Updates", "checkForUpdates:", ""
        )
        self.update_menu_item.setTarget_(self)
        self.menu.addItem_(self.update_menu_item)

        self.menu.addItem_(NSMenuItem.separatorItem())

        # About
        about_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            f"About {APP_NAME}", "showAbout:", ""
        )
        about_item.setTarget_(self)
        self.menu.addItem_(about_item)

        # Quit
        quit_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Quit", "terminate:", "q"
        )
        quit_item.setKeyEquivalentModifierMask_(AppKit.NSCommandKeyMask)
        self.menu.addItem_(quit_item)

    def _create_statistics_menu(self):
        """Create the statistics submenu"""
        menu = NSMenu.alloc().init()
        menu.setTitle_("Statistics")

        # Total stats display
        self.total_time_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Total Time: --", None, ""
        )
        self.total_time_item.setEnabled_(False)
        menu.addItem_(self.total_time_item)

        self.total_words_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Total Words: --", None, ""
        )
        self.total_words_item.setEnabled_(False)
        menu.addItem_(self.total_words_item)

        self.session_count_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Sessions: --", None, ""
        )
        self.session_count_item.setEnabled_(False)
        menu.addItem_(self.session_count_item)

        menu.addItem_(NSMenuItem.separatorItem())

        # Refresh
        refresh_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Refresh", "refreshStatistics:", ""
        )
        refresh_item.setTarget_(self)
        menu.addItem_(refresh_item)

        menu.addItem_(NSMenuItem.separatorItem())

        # Export
        export_json_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Export as JSON...", "exportJSON:", ""
        )
        export_json_item.setTarget_(self)
        menu.addItem_(export_json_item)

        export_csv_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Export as CSV...", "exportCSV:", ""
        )
        export_csv_item.setTarget_(self)
        menu.addItem_(export_csv_item)

        return menu

    def _create_preferences_menu(self):
        """Create the preferences submenu"""
        menu = NSMenu.alloc().init()
        menu.setTitle_("Preferences")

        # Launch agent toggle
        self.launch_agent_menu_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Start on Login", "toggleLaunchAgent:", ""
        )
        self.launch_agent_menu_item.setTarget_(self)
        self.launch_agent_menu_item.setState_(AppKit.NSOffState)
        menu.addItem_(self.launch_agent_menu_item)

        menu.addItem_(NSMenuItem.separatorItem())

        # Open preferences (placeholder for future expansion)
        prefs_window_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
            "Open Preferences...", "showPreferences:", ","
        )
        prefs_window_item.setTarget_(self)
        menu.addItem_(prefs_window_item)

        return menu

    def set_icon(self, icon_name):
        """Set the status bar icon"""
        try:
            # Try to load from bundle resources first
            bundle = NSBundle.mainBundle()
            image_path = bundle.pathForResource_ofType_(icon_name, "pdf")

            if image_path:
                image = NSImage.alloc().initWithContentsOfFile_(image_path)
            else:
                # Fallback: create a simple colored circle
                image = self._create_fallback_icon(icon_name)

            if image:
                image.setTemplate_(True)  # Support dark mode
                self.status_item.setImage_(image)
        except Exception as e:
            print(f"Error setting icon: {e}")

    def _create_fallback_icon(self, icon_name):
        """Create a fallback icon if resource files are not available"""
        size = AppKit.NSSize(16, 16)
        image = NSImage.alloc().initWithSize_(size)

        image.lockFocus()

        # Draw based on status
        if icon_name == self.ICON_RUNNING:
            color = AppKit.NSColor.greenColor()
        elif icon_name == self.ICON_ERROR:
            color = AppKit.NSColor.redColor()
        else:
            color = AppKit.NSColor.grayColor()

        color.setFill()
        rect = AppKit.NSMakeRect(2, 2, 12, 12)
        path = AppKit.NSBezierPath.bezierPathWithOvalInRect_(rect)
        path.fill()

        image.unlockFocus()
        return image

    # MARK: - Status Updates

    def update_server_status(self, status, message=None):
        """Update the displayed server status"""
        self.current_status = status

        # Update status text
        status_text = message or self._status_to_text(status)
        self.status_menu_item.setTitle_(f"Status: {status_text}")

        # Update icon
        if status == ServerStatus.RUNNING:
            self.set_icon(self.ICON_RUNNING)
        elif status in (ServerStatus.ERROR, ServerStatus.CRASH_LOOP):
            self.set_icon(self.ICON_ERROR)
        else:
            self.set_icon(self.ICON_IDLE)

        # Update menu item states
        is_running = status == ServerStatus.RUNNING
        is_stopped = status == ServerStatus.STOPPED

        self.start_menu_item.setEnabled_(is_stopped)
        self.stop_menu_item.setEnabled_(is_running)
        self.restart_menu_item.setEnabled_(is_running or status == ServerStatus.ERROR)

    def _status_to_text(self, status):
        """Convert status code to display text"""
        status_map = {
            ServerStatus.STOPPED: "Stopped",
            ServerStatus.STARTING: "Starting...",
            ServerStatus.RUNNING: "Running",
            ServerStatus.STOPPING: "Stopping...",
            ServerStatus.ERROR: "Error",
            ServerStatus.CRASH_LOOP: "Crash Loop",
        }
        return status_map.get(status, status.capitalize())

    def update_statistics(self, stats):
        """Update the statistics display"""
        if not stats:
            return

        total_time = stats.get("total_time", 0)
        total_words = stats.get("total_words", 0)
        session_count = stats.get("session_count", 0)

        # Format time
        hours = int(total_time // 3600)
        minutes = int((total_time % 3600) // 60)
        time_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

        self.total_time_item.setTitle_(f"Total Time: {time_str}")
        self.total_words_item.setTitle_(f"Total Words: {total_words:,}")
        self.session_count_item.setTitle_(f"Sessions: {session_count}")

    def update_launch_agent_status(self, is_registered):
        """Update the launch agent menu item state"""
        state = AppKit.NSOnState if is_registered else AppKit.NSOffState
        self.launch_agent_menu_item.setState_(state)

    def show_update_available(self, version):
        """Show that an update is available in the menu"""
        self.update_available_version = version
        self.update_menu_item.setTitle_(f"Update Available: {version}")
        self.update_menu_item.setState_(AppKit.NSOnState)

    # MARK: - Action Handlers

    def startServer_(self, sender):
        """Handle start server menu action"""
        if self.delegate:
            self.delegate.start_server_requested()

    def stopServer_(self, sender):
        """Handle stop server menu action"""
        if self.delegate:
            self.delegate.stop_server_requested()

    def restartServer_(self, sender):
        """Handle restart server menu action"""
        if self.delegate:
            self.delegate.restart_server_requested()

    def checkForUpdates_(self, sender):
        """Handle check for updates menu action"""
        if self.delegate:
            self.delegate.check_for_updates_requested()

    def toggleLaunchAgent_(self, sender):
        """Handle toggle launch agent menu action"""
        if self.delegate:
            self.delegate.toggle_launch_agent_requested()

    def showPreferences_(self, sender):
        """Handle show preferences menu action"""
        if self.delegate:
            self.delegate.show_preferences_requested()

    def refreshStatistics_(self, sender):
        """Handle refresh statistics menu action"""
        if self.delegate:
            self.delegate.show_statistics_requested()

    def exportJSON_(self, sender):
        """Handle export JSON menu action"""
        if self.delegate:
            self.delegate.export_statistics_requested("json")

    def exportCSV_(self, sender):
        """Handle export CSV menu action"""
        if self.delegate:
            self.delegate.export_statistics_requested("csv")

    def showAbout_(self, sender):
        """Show about dialog"""
        from Cocoa import NSAlert

        alert = NSAlert.alloc().init()
        alert.setMessageText_(f"About {APP_NAME}")
        alert.setInformativeText_(
            f"{APP_NAME} v{VERSION}\n\n"
            "A native macOS menu bar companion for OpenType.\n\n"
            "Manage your OpenType voice-to-text server directly from the menu bar.\n"
            "https://github.com/G3niusYukki/OpenType"
        )
        alert.runModal()
