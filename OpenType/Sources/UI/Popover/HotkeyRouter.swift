import Foundation
import Models

/// Routes hotkey notifications to the popover + recording start. The
/// existing `StatusBarController` still handles Hands-Free / Quick-Answer
/// directly; this router handles the other three modes and is testable.
@MainActor
public final class HotkeyRouter {
    private let factory: PopoverViewModelFactory
    private var observers: [NSObjectProtocol] = []

    public init(viewModelFactory: PopoverViewModelFactory) {
        self.factory = viewModelFactory
        observe()
    }

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    private func observe() {
        observers.append(
            NotificationCenter.default.addObserver(
                forName: .hotkeyBasic, object: nil, queue: .main
            ) { [weak self] _ in
                Task { @MainActor in self?.factory.openPopoverAndStart(mode: .basic) }
            }
        )
        observers.append(
            NotificationCenter.default.addObserver(
                forName: .hotkeyTranslate, object: nil, queue: .main
            ) { [weak self] _ in
                Task { @MainActor in self?.factory.openPopoverAndStart(mode: .translate) }
            }
        )
        observers.append(
            NotificationCenter.default.addObserver(
                forName: .hotkeyEditSelected, object: nil, queue: .main
            ) { [weak self] _ in
                Task { @MainActor in self?.factory.openPopoverAndStart(mode: .editSelected) }
            }
        )
    }
}
