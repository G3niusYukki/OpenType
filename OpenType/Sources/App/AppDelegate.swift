import AppKit
import OpenTypeUI

class AppDelegate: NSObject, NSApplicationDelegate {
    let statusBarController = StatusBarController()

    func applicationDidFinishLaunching(_ notification: Notification) {
        print("OpenType launched")
    }

    func applicationWillTerminate(_ notification: Notification) {
        print("OpenType terminating")
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}
