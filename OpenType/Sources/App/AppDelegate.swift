import AppKit
import OpenTypeUI
import Services

class AppDelegate: NSObject, NSApplicationDelegate {
    let statusBarController = StatusBarController()
    private let hotkeyService = HotkeyService.shared

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupHotkeys()
    }

    private func setupHotkeys() {
        if !hotkeyService.checkPermission() {
            hotkeyService.requestPermission()
        }

        let hotkeyNames = [
            (CGKeyCode(2),  CGEventFlags.maskCommand.union(.maskShift), "Basic Voice Input (\u{2318}\u{21E7}D)"),
            (CGKeyCode(49), CGEventFlags.maskCommand.union(.maskShift), "Hands-Free (\u{2318}\u{21E7}Space)"),
            (CGKeyCode(17), CGEventFlags.maskCommand.union(.maskShift), "Translate (\u{2318}\u{21E7}T)"),
            (CGKeyCode(14), CGEventFlags.maskCommand.union(.maskShift), "Edit Selected (\u{2318}\u{21E7}E)"),
        ]

        var failedHotkeys: [String] = []

        for (keyCode, modifiers, name) in hotkeyNames {
            let handler: () -> Void
            switch name {
            case "Basic Voice Input (\u{2318}\u{21E7}D)":    handler = { [weak self] in self?.onBasicHotkey() }
            case "Hands-Free (\u{2318}\u{21E7}Space)":       handler = { [weak self] in self?.onHandsFreeHotkey() }
            case "Translate (\u{2318}\u{21E7}T)":             handler = { [weak self] in self?.onTranslateHotkey() }
            case "Edit Selected (\u{2318}\u{21E7}E)":        handler = { [weak self] in self?.onEditSelectedHotkey() }
            default:                             handler = {}
            }

            if !hotkeyService.register(keyCode: keyCode, modifiers: modifiers, handler: handler) {
                failedHotkeys.append(name)
            }
        }

        if !failedHotkeys.isEmpty {
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = "Some Hotkeys Could Not Be Registered"
                alert.informativeText = "The following hotkeys are unavailable because another application is using them: \(failedHotkeys.joined(separator: ", ")).\n\nYou can change hotkeys in Settings > General."
                alert.alertStyle = .warning
                alert.addButton(withTitle: "Open Settings")
                alert.addButton(withTitle: "Later")
                let response = alert.runModal()
                if response == .alertFirstButtonReturn {
                    NotificationCenter.default.post(name: .openSettingsWindow, object: nil)
                }
            }
        }
    }

    private func onBasicHotkey() {
        NotificationCenter.default.post(name: .hotkeyBasic, object: nil)
    }

    private func onHandsFreeHotkey() {
        NotificationCenter.default.post(name: .hotkeyHandsFree, object: nil)
    }

    private func onTranslateHotkey() {
        NotificationCenter.default.post(name: .hotkeyTranslate, object: nil)
    }

    private func onEditSelectedHotkey() {
        NotificationCenter.default.post(name: .hotkeyEditSelected, object: nil)
    }

    func applicationWillTerminate(_ notification: Notification) {
        hotkeyService.unregisterAll()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}

extension Notification.Name {
    static let hotkeyBasic = Notification.Name("hotkeyBasic")
    static let hotkeyHandsFree = Notification.Name("hotkeyHandsFree")
    static let hotkeyTranslate = Notification.Name("hotkeyTranslate")
    static let hotkeyEditSelected = Notification.Name("hotkeyEditSelected")
    static let openSettingsWindow = Notification.Name("openSettingsWindow")
}
