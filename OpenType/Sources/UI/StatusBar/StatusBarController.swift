import AppKit
import SwiftUI
import Utilities

public class StatusBarController: NSObject, ObservableObject {
    private var statusItem: NSStatusItem
    private var popover: NSPopover
    @Published public var currentIcon: StatusBarIcon = .idle

    public override init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        popover = NSPopover()

        super.init()

        setupStatusItem()
        setupPopover()
    }

    private func setupStatusItem() {
        guard let button = statusItem.button else { return }
        button.image = NSImage(systemSymbolName: StatusBarIcon.idle.symbolName, accessibilityDescription: "OpenType")
        button.action = #selector(togglePopover)
        button.target = self
    }

    private func setupPopover() {
        popover.contentSize = NSSize(width: Constants.UI.popoverWidth, height: Constants.UI.popoverHeight)
        popover.behavior = .transient
        popover.animates = true
    }

    @objc private func togglePopover() {
        if popover.isShown {
            closePopover()
        } else {
            showPopover()
        }
    }

    public func showPopover() {
        guard let button = statusItem.button else { return }
        popover.contentViewController = NSHostingController(rootView: PopoverView())
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
    }

    public func closePopover() {
        popover.performClose(nil)
    }

    public func updateIcon(_ icon: StatusBarIcon) {
        DispatchQueue.main.async { [weak self] in
            self?.currentIcon = icon
            self?.statusItem.button?.image = NSImage(
                systemSymbolName: icon.symbolName,
                accessibilityDescription: "OpenType"
            )
            if let button = self?.statusItem.button {
                button.contentTintColor = icon.tintColor
            }
        }
    }
}
