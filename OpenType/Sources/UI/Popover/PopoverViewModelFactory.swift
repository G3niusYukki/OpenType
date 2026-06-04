import Foundation
import Models

/// Abstraction over `StatusBarController` popover creation so `HotkeyRouter`
/// can be unit-tested without spinning up an `NSStatusItem`.
public protocol PopoverViewModelFactory: AnyObject {
    @MainActor
    func makeViewModel() -> PopoverViewModel
    /// Opens the popover (no-op if already visible) and starts a recording
    /// in the given mode. Implementation in `StatusBarController`.
    @MainActor
    func openPopoverAndStart(mode: VoiceMode)
}
