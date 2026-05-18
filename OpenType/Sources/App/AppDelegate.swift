import AppKit
import Data
import Models
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
        // Crash recovery: if the app crashed while recording, clean up stale state
        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        let wasRecording = defaults.bool(forKey: "isRecordingActive")
        if wasRecording {
            print("[CrashRecovery] Detected stale recording state from previous session — cleaning up")
            defaults.set(false, forKey: "isRecordingActive")
            AudioCaptureService.shared.cleanupTempFiles(keepingRecent: 5)
        }

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
        setupHotkeyObserver()
        setupUpdater()
        setupNotifications()

        Task {
            _ = await NotificationService.shared.requestPermission()
        }

        // Start health monitoring
        let healthMonitor = HealthMonitor.shared
        healthMonitor.onStaleRecording = { [weak self] in
            Task { @MainActor in
                // Force-stop any stale recording
                if AudioCaptureService.shared.isRecording {
                    _ = try? await AudioCaptureService.shared.stopRecording()
                }
            }
        }
        healthMonitor.onHighMemory = { memoryMB in
            // Log but don't crash — let the OS handle memory pressure naturally
            print("[HealthMonitor] High memory: \(Int(memoryMB)) MB")
        }
        healthMonitor.onHealthLog = { message in
            print("[HealthMonitor] \(message)")
        }
        healthMonitor.startMonitoring()
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
            // 检查该模式是否启用
            if let mode = VoiceMode(rawValue: def.id), let modeConfig = SettingsStore.shared.voiceModeConfigs[mode], !modeConfig.enabled {
                continue
            }

            let config = SettingsStore.shared.hotkeyConfigs[def.id]
            let keyCode = CGKeyCode(config?.keyCode ?? def.keyCode)
            let modifiers = CGEventFlags(rawValue: UInt64(config?.modifiers ?? def.modifiers))

            let handler: () -> Void
            switch def.id {
            case "basic":        handler = { [weak self] in self?.onBasicHotkey() }
            case "handsFree":    handler = { [weak self] in self?.onHandsFreeHotkey() }
            case "translate":    handler = { [weak self] in self?.onTranslateHotkey() }
            case "editSelected": handler = { [weak self] in self?.onEditSelectedHotkey() }
            case "quickAnswer":  handler = { [weak self] in self?.onQuickAnswerHotkey() }
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

    private func onQuickAnswerHotkey() {
        NotificationCenter.default.post(name: .hotkeyQuickAnswer, object: nil)
    }

    private func setupHotkeyObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(reloadHotkeys),
            name: .hotkeyConfigChanged,
            object: nil
        )
    }

    @objc private func reloadHotkeys() {
        hotkeyService.unregisterAll()
        setupHotkeys()
    }

    func applicationWillTerminate(_ notification: Notification) {
        // 停止录音
        if AudioCaptureService.shared.isRecording {
            let semaphore = DispatchSemaphore(value: 0)
            Task {
                _ = try? await AudioCaptureService.shared.stopRecording()
                semaphore.signal()
            }
            _ = semaphore.wait(timeout: .now() + 2)
        }

        hotkeyService.unregisterAll()
        AudioCaptureService.shared.cleanupTempFiles(keepingRecent: 0)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}


