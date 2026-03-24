import AppKit
import SwiftUI
import Utilities

public class MainWindowController: NSWindowController {
    public convenience init() {
        let mainView = MainTabView()
        let hostingController = NSHostingController(rootView: mainView)

        let window = NSWindow(contentViewController: hostingController)
        window.title = "OpenType"
        window.setContentSize(NSSize(
            width: Constants.UI.mainWindowWidth,
            height: Constants.UI.mainWindowHeight
        ))
        window.styleMask = [.titled, .closable, .resizable, .miniaturizable]
        window.center()
        window.minSize = NSSize(width: 400, height: 300)

        self.init(window: window)
    }

    public func showWindow() {
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
