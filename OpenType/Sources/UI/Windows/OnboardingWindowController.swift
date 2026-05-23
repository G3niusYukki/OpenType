import AppKit
import SwiftUI
import Utilities

public class OnboardingWindowController: NSWindowController {
    private static var sharedController: OnboardingWindowController?

    public convenience init(onComplete: @escaping () -> Void = {}) {
        let onboardingView = OnboardingView(onComplete: {
            onComplete()
            OnboardingWindowController.sharedController?.close()
            OnboardingWindowController.sharedController = nil
        })
        let hostingController = NSHostingController(rootView: onboardingView)

        let window = NSWindow(contentViewController: hostingController)
        window.title = "Welcome to OpenType"
        window.setContentSize(NSSize(
            width: Constants.UI.onboardingWindowWidth,
            height: Constants.UI.onboardingWindowHeight
        ))
        window.styleMask = [.titled, .closable]
        window.isMovableByWindowBackground = true
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.center()

        // Prevent closing without completing onboarding (unless they click Skip)
        window.isReleasedWhenClosed = false

        self.init(window: window)
    }

    public static func show(onComplete: @escaping () -> Void = {}) {
        if sharedController == nil {
            sharedController = OnboardingWindowController(onComplete: onComplete)
        }
        sharedController?.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    public static func closeShared() {
        sharedController?.close()
        sharedController = nil
    }
}
