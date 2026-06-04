import AppKit
import SwiftUI
import Combine
import Data
import Models
import Utilities

public class StatusBarController: NSObject, ObservableObject, PopoverViewModelFactory {
    private var statusItem: NSStatusItem
    private var popover: NSPopover
    private var popoverViewModel: PopoverViewModel?
    private var cancellables = Set<AnyCancellable>()
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
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleQuickAnswerHotkey),
            name: .hotkeyQuickAnswer,
            object: nil
        )
        // The other three modes (basic/translate/editSelected) are routed
        // through HotkeyRouter so the routing can be unit-tested.
        Task { @MainActor in
            _ = HotkeyRouter(viewModelFactory: self)
        }
    }

    @objc private func handleHandsFreeHotkey() {
        guard let viewModel = popoverViewModel else { return }
        Task { @MainActor in
            viewModel.toggleHandsFree()
        }
    }

    @objc private func handleQuickAnswerHotkey() {
        Task { @MainActor in
            if !popover.isShown {
                showPopover()
            }
            guard let viewModel = popoverViewModel else { return }
            viewModel.startRecording(mode: .quickAnswer)
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

        // Whisper Mode toggle
        let whisperItem = NSMenuItem(
            title: SettingsStore.shared.whisperModeEnabled ? "✓ Whisper Mode" : "Whisper Mode",
            action: #selector(toggleWhisperMode),
            keyEquivalent: ""
        )
        menu.addItem(whisperItem)

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

    @objc private func toggleWhisperMode() {
        SettingsStore.shared.whisperModeEnabled.toggle()
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
        observeViewModelState(viewModel)
    }

    @MainActor private func observeViewModelState(_ viewModel: PopoverViewModel) {
        cancellables.removeAll()

        // Map recording/processing state to status bar icon
        Publishers.CombineLatest(viewModel.$isRecording, viewModel.$isProcessing)
            .map { (isRecording, isProcessing) -> StatusBarIcon in
                if isRecording {
                    return SettingsStore.shared.whisperModeEnabled ? .whisperRecording : .recording
                }
                if isProcessing { return .processing }
                return .idle
            }
            .removeDuplicates()
            .sink { [weak self] icon in
                self?.updateIcon(icon)
            }
            .store(in: &cancellables)

        // Error state: show error icon for 3 seconds then revert
        NotificationCenter.default.publisher(for: .transcriptionError)
            .map { _ in StatusBarIcon.error }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] icon in
                self?.updateIcon(icon)
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
                    self?.updateIcon(.idle)
                }
            }
            .store(in: &cancellables)
    }

    public func closePopover() {
        popover.performClose(nil)
        // Keep icon reflecting state (hands-free may still be recording)
        // Cancellables persist so icon updates continue
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

    // MARK: - PopoverViewModelFactory

    public func makeViewModel() -> PopoverViewModel {
        PopoverViewModel()
    }

    public func openPopoverAndStart(mode: VoiceMode) {
        if !popover.isShown {
            showPopover()
        }
        guard let viewModel = popoverViewModel else { return }
        viewModel.startRecording(mode: mode)
    }
}
