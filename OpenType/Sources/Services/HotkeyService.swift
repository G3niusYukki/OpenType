import Foundation
import CoreGraphics
import AppKit

public class HotkeyService {
    public static let shared = HotkeyService()

    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private struct Registration {
        let modifiers: CGEventFlags
        let handler: () -> Void
    }
    private var registrations: [CGKeyCode: Registration] = [:]

    private init() {}

    private var permissionDenied = false

    @discardableResult
    public func register(keyCode: CGKeyCode, modifiers: CGEventFlags, handler: @escaping () -> Void) -> Bool {
        registrations[keyCode] = Registration(modifiers: modifiers, handler: handler)

        // Create event tap on first registration
        if eventTap == nil {
            return createEventTap()
        }
        return true
    }

    private func createEventTap() -> Bool {
        let eventMask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue) | (1 << CGEventType.flagsChanged.rawValue)

        let callback: CGEventTapCallBack = { proxy, type, event, refcon in
            guard let refcon = refcon else { return Unmanaged.passUnretained(event) }
            let service = Unmanaged<HotkeyService>.fromOpaque(refcon).takeUnretainedValue()
            return service.handleEvent(proxy: proxy, type: type, event: event)
        }

        let refcon = Unmanaged.passUnretained(self).toOpaque()

        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: CGEventMask(eventMask),
            callback: callback,
            userInfo: refcon
        ) else {
            permissionDenied = true
            return false
        }

        runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)

        eventTap = tap
        return true
    }

    private func handleEvent(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap = eventTap {
                CGEvent.tapEnable(tap: tap, enable: true)
            }
            return Unmanaged.passUnretained(event)
        }

        guard type == .keyDown else { return Unmanaged.passUnretained(event) }

        let keyCode = CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode))
        let flags = event.flags

        guard let registration = registrations[keyCode] else {
            return Unmanaged.passUnretained(event)
        }

        // Check that exactly the required modifier flags are present
        let required = registration.modifiers
        let actual = flags.intersection(.maskCommand.union(.maskShift).union(.maskAlternate).union(.maskControl))
        if actual == required {
            DispatchQueue.main.async {
                registration.handler()
            }
            return nil
        }

        return Unmanaged.passUnretained(event)
    }

    public func unregisterAll() {
        if let tap = eventTap {
            CGEvent.tapEnable(tap: tap, enable: false)
        }
        if let source = runLoopSource {
            CFRunLoopRemoveSource(CFRunLoopGetCurrent(), source, .commonModes)
        }
        eventTap = nil
        runLoopSource = nil
        registrations.removeAll()
    }

    public func checkPermission() -> Bool {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: false] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    public func requestPermission() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
    }

    deinit {
        unregisterAll()
    }
}
