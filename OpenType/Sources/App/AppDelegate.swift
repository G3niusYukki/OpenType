import AppKit
import Data
import OpenTypeUI
import Services
import Sparkle
import Utilities

class AppDelegate: NSObject, NSApplicationDelegate {
    let statusBarController = StatusBarController()
    private let hotkeyService = HotkeyService.shared
    private var settingsWindowController: SettingsWindowController?
    private var mainWindowController: MainWindowController?
    private var updaterController: SPUStandardUpdaterController?
    private var updaterDelegate: UpdaterDelegate?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Run Electron config migration if needed
        if MigrationService.shared.needsMigration {
            do {
                try MigrationService.shared.migrate()
            } catch {
                print("Migration failed: \(error)")
            }
        }

        setupSettingsWindowObserver()
        setupMainWindowObserver()
        setupHotkeys()
        setupUpdater()
        setupNotifications()
    }

    private func setupSettingsWindowObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(openSettings),
            name: .openSettingsWindow,
            object: nil
        )
    }

    private func setupMainWindowObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(openMainWindow),
            name: .openHistoryWindow,
            object: nil
        )
    }

    private func setupNotifications() {
        NotificationCenter.default.addObserver(
            forName: .openDiagnosticsWindow,
            object: nil,
            queue: .main
        ) { _ in
            DiagnosticsWindowController.show()
        }
    }

    private func setupUpdater() {
        updaterDelegate = UpdaterDelegate()
        updaterController = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: updaterDelegate,
            userDriverDelegate: nil
        )
    }

    @objc private func openMainWindow() {
        if mainWindowController == nil {
            mainWindowController = MainWindowController()
        }
        mainWindowController?.showWindow()
    }

    @objc private func openSettings() {
        if settingsWindowController == nil {
            settingsWindowController = SettingsWindowController()
        }
        settingsWindowController?.showWindow()
    }

    private func setupHotkeys() {
        // Request accessibility permission once (shows one dialog)
        if !hotkeyService.checkPermission() {
            hotkeyService.requestPermission()
        }

        var failedHotkeys: [String] = []

        for def in Constants.Hotkeys.defaultHotkeys {
            let config = SettingsStore.shared.hotkeyConfigs[def.id]
            let keyCode = CGKeyCode(config?.keyCode ?? def.keyCode)
            let modifiers = CGEventFlags(rawValue: UInt64(config?.modifiers ?? def.modifiers))

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

        // Show a single alert if any hotkeys failed
        if !failedHotkeys.isEmpty {
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = "Accessibility Permission Required"
                alert.informativeText = "OpenType needs Accessibility permission to register global hotkeys. The following hotkeys could not be registered: \(failedHotkeys.joined(separator: ", ")).\n\nPlease grant access in System Settings > Privacy & Security > Accessibility, then restart OpenType."
                alert.alertStyle = .warning
                alert.addButton(withTitle: "Open System Settings")
                alert.addButton(withTitle: "Later")
                let response = alert.runModal()
                if response == .alertFirstButtonReturn {
                    if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
                        NSWorkspace.shared.open(url)
                    }
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
