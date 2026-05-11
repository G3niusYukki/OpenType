import AppKit
import SwiftUI
import Utilities

public class StatusBarController: NSObject, ObservableObject {
    private var statusItem: NSStatusItem
    private var popover: NSPopover
    private var popoverViewModel: PopoverViewModel?
    @Published public var currentIcon: StatusBarIcon = .idle

    public override init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        popover = NSPopover()

        super.init()

        setupStatusItem()
        setupPopover()
        setupNotificationObservers()
    }

    private func setupNotificationObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleHandsFreeHotkey),
            name: .hotkeyHandsFree,
            object: nil
        )
    }

    @objc private func handleHandsFreeHotkey() {
        guard let viewModel = popoverViewModel else { return }
        Task { @MainActor in
            viewModel.toggleHandsFree()
        }
    }

    private func setupStatusItem() {
        guard let button = statusItem.button else { return }
        button.image = NSImage(systemSymbolName: StatusBarIcon.idle.symbolName, accessibilityDescription: "OpenType")
        button.action = #selector(statusBarButtonClicked(_:))
        button.target = self
        button.sendAction(on: [.leftMouseUp, .rightMouseUp])
    }

    private func setupPopover() {
        popover.contentSize = NSSize(width: Constants.UI.popoverWidth, height: Constants.UI.popoverHeight)
        popover.behavior = .transient
        popover.animates = true
    }

    @objc private func statusBarButtonClicked(_ sender: Any?) {
        if NSApp.currentEvent?.type == .rightMouseUp {
            showMenu()
        } else {
            togglePopover()
        }
    }

    private func showMenu() {
        let menu = NSMenu()

        menu.addItem(NSMenuItem(title: "Open OpenType", action: #selector(openApp), keyEquivalent: "o"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Settings...", action: #selector(openSettings), keyEquivalent: ","))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit OpenType", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))

        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        DispatchQueue.main.async { [weak self] in
            self?.statusItem.menu = nil
        }
    }

    @objc private func openApp() {
        NSApp.activate(ignoringOtherApps: true)
        NotificationCenter.default.post(name: .openHistoryWindow, object: nil)
    }

    @objc private func openSettings() {
        NotificationCenter.default.post(name: .openSettingsWindow, object: nil)
    }

    @objc private func togglePopover() {
        if popover.isShown {
            closePopover()
        } else {
            Task { @MainActor in
                showPopover()
            }
        }
    }

    @MainActor public func showPopover() {
        guard let button = statusItem.button else { return }
        let viewModel = PopoverViewModel()
        self.popoverViewModel = viewModel
        popover.contentViewController = NSHostingController(rootView: PopoverView(viewModel: viewModel))
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
