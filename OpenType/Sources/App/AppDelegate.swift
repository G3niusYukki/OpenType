import AppKit
import Data
import OpenTypeUI
import Services

class AppDelegate: NSObject, NSApplicationDelegate {
    let statusBarController = StatusBarController()
    private let hotkeyService = HotkeyService.shared
    private var settingsWindowController: SettingsWindowController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupSettingsWindowObserver()
        setupHotkeys()
    }

    private func setupSettingsWindowObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(openSettings),
            name: .openSettingsWindow,
            object: nil
        )
    }

    @objc private func openSettings() {
        if settingsWindowController == nil {
            settingsWindowController = SettingsWindowController()
        }
        settingsWindowController?.showWindow()
    }

    private func setupHotkeys() {
        if !hotkeyService.checkPermission() {
            hotkeyService.requestPermission()
        }

        typealias HotkeyDef = (id: String, defaultKeyCode: CGKeyCode, defaultModifiers: CGEventFlags, name: String)
        let hotkeyDefs: [HotkeyDef] = [
            ("basic",       CGKeyCode(2),  CGEventFlags.maskCommand.union(.maskShift), "Basic Voice Input (\u{2318}\u{21E7}D)"),
            ("handsFree",   CGKeyCode(49), CGEventFlags.maskCommand.union(.maskShift), "Hands-Free (\u{2318}\u{21E7}Space)"),
            ("translate",   CGKeyCode(17), CGEventFlags.maskCommand.union(.maskShift), "Translate (\u{2318}\u{21E7}T)"),
            ("editSelected",CGKeyCode(14), CGEventFlags.maskCommand.union(.maskShift), "Edit Selected (\u{2318}\u{21E7}E)"),
        ]

        var failedHotkeys: [String] = []

        for def in hotkeyDefs {
            let config = SettingsStore.shared.hotkeyConfigs[def.id]
            let keyCode = CGKeyCode(config?.keyCode ?? Int(def.defaultKeyCode))
            let modifiers = CGEventFlags(rawValue: UInt64(config?.modifiers ?? UInt(def.defaultModifiers.rawValue)))

            let handler: () -> Void
            switch def.id {
            case "basic":        handler = { [weak self] in self?.onBasicHotkey() }
            case "handsFree":    handler = { [weak self] in self?.onHandsFreeHotkey() }
            case "translate":    handler = { [weak self] in self?.onTranslateHotkey() }
            case "editSelected": handler = { [weak self] in self?.onEditSelectedHotkey() }
            default:             handler = {}
            }

            if !hotkeyService.register(keyCode: keyCode, modifiers: modifiers, handler: handler) {
                failedHotkeys.append(def.name)
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
}
