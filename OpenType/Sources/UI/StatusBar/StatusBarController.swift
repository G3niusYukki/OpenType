import AppKit

public class StatusBarController {
    private var statusItem: NSStatusItem

    public init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "mic.fill", accessibilityDescription: "OpenType")
        }
    }
}
