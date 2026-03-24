import Foundation
import CoreGraphics
import AppKit

public class HotkeyService {
    public static let shared = HotkeyService()

    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var handlers: [CGKeyCode: () -> Void] = [:]
    private var registeredModifiers: [UInt64: Bool] = [:]

    private init() {}

    private var permissionDenied = false

    public func register(keyCode: CGKeyCode, modifiers: CGEventFlags, handler: @escaping () -> Void) -> Bool {
        handlers[keyCode] = handler
        registeredModifiers[modifiers.rawValue] = true

        if eventTap != nil {
            unregisterAll()
        }

        return createEventTap()
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
        guard type == .keyDown else { return Unmanaged.passUnretained(event) }

        let keyCode = CGKeyCode(event.getIntegerValueField(.keyboardEventKeycode))
        let flags = event.flags

        for (registeredKeyCode, handler) in handlers {
            if keyCode == registeredKeyCode {
                let hasCommand = flags.contains(.maskCommand)
                let hasShift = flags.contains(.maskShift)

                let requiresCommand = registeredModifiers[CGEventFlags.maskCommand.union(.maskShift).rawValue] == true
                if requiresCommand && hasCommand && hasShift {
                    DispatchQueue.main.async {
                        handler()
                    }
                    return nil
                }
            }
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
        handlers.removeAll()
        registeredModifiers.removeAll()
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
