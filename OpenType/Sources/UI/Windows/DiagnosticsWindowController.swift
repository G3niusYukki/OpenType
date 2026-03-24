import AppKit
import SwiftUI
import Utilities

public class DiagnosticsWindowController: NSWindowController {
    private static var sharedController: DiagnosticsWindowController?

    public convenience init() {
        let diagnosticsView = DiagnosticsView()
        let hostingController = NSHostingController(rootView: diagnosticsView)

        let window = NSWindow(contentViewController: hostingController)
        window.title = "Diagnostics"
        window.setContentSize(NSSize(
            width: Constants.UI.diagnosticsWindowWidth,
            height: Constants.UI.diagnosticsWindowHeight
        ))
        window.styleMask = [.titled, .closable]
        window.center()

        self.init(window: window)
    }

    public static func show() {
        if sharedController == nil {
            sharedController = DiagnosticsWindowController()
        }
        sharedController?.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
