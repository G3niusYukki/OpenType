import AppKit
import SwiftUI
import OpenTypeUI

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusBarController: StatusBarController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusBarController = StatusBarController()
        print("OpenType launched (stub)")
    }

    func applicationWillTerminate(_ notification: Notification) {
        print("OpenType terminating")
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}
