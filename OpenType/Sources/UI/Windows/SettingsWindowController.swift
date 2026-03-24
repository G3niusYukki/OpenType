import AppKit
import SwiftUI
import Utilities

public class SettingsWindowController: NSWindowController {
    public convenience init() {
        let settingsView = SettingsView()
        let hostingController = NSHostingController(rootView: settingsView)

        let window = NSWindow(contentViewController: hostingController)
        window.title = "Settings"
        window.setContentSize(NSSize(
            width: Constants.UI.settingsWindowWidth,
            height: Constants.UI.settingsWindowHeight
        ))
        window.styleMask = [.titled, .closable]
        window.center()

        self.init(window: window)
    }

    public func showWindow() {
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
