import XCTest
@testable import Services
@testable import Models
@testable import OpenTypeUI
import AppKit

@MainActor
final class HotkeyRouterTests: XCTestCase {
    func test_basic_notification_opens_popover_and_starts_basic_recording() {
        let factory = PopoverViewModelFactoryStub()
        let r = HotkeyRouter(viewModelFactory: factory)
        withExtendedLifetime(r) {
            NotificationCenter.default.post(name: .hotkeyBasic, object: nil)
            let exp = expectation(description: "dispatched")
            DispatchQueue.main.async { exp.fulfill() }
            self.wait(for: [exp], timeout: 0.5)

            XCTAssertEqual(factory.lastStartMode, .basic)
            XCTAssertEqual(factory.openCount, 1)
        }
    }

    func test_translate_notification_starts_translate_mode() {
        let factory = PopoverViewModelFactoryStub()
        let r = HotkeyRouter(viewModelFactory: factory)
        withExtendedLifetime(r) {
            NotificationCenter.default.post(name: .hotkeyTranslate, object: nil)
            let exp = expectation(description: "dispatched")
            DispatchQueue.main.async { exp.fulfill() }
            self.wait(for: [exp], timeout: 0.5)

            XCTAssertEqual(factory.lastStartMode, .translate)
        }
    }

    func test_editSelected_notification_starts_editSelected_mode() {
        let factory = PopoverViewModelFactoryStub()
        let r = HotkeyRouter(viewModelFactory: factory)
        withExtendedLifetime(r) {
            NotificationCenter.default.post(name: .hotkeyEditSelected, object: nil)
            let exp = expectation(description: "dispatched")
            DispatchQueue.main.async { exp.fulfill() }
            self.wait(for: [exp], timeout: 0.5)

            XCTAssertEqual(factory.lastStartMode, .editSelected)
        }
    }
}

// MARK: - Stubs

@MainActor
final class PopoverViewModelFactoryStub: PopoverViewModelFactory {
    private(set) var lastStartMode: VoiceMode?
    private(set) var openCount = 0

    func makeViewModel() -> PopoverViewModel { PopoverViewModel() }
    func openPopoverAndStart(mode: VoiceMode) {
        openCount += 1
        lastStartMode = mode
    }
}
