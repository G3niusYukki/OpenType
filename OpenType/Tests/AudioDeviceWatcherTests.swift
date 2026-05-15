import XCTest
@testable import Services

final class AudioDeviceWatcherTests: XCTestCase {

    func testStartStopWatching() {
        let watcher = AudioDeviceWatcher()

        XCTAssertFalse(watcher.isWatching)

        watcher.startWatching()
        XCTAssertTrue(watcher.isWatching)

        watcher.stopWatching()
        XCTAssertFalse(watcher.isWatching)
    }

    func testDoubleStartIsIdempotent() {
        let watcher = AudioDeviceWatcher()
        watcher.startWatching()
        watcher.startWatching() // Should not crash or double-register
        XCTAssertTrue(watcher.isWatching)
        watcher.stopWatching()
    }

    func testStopWithoutStartIsNoop() {
        let watcher = AudioDeviceWatcher()
        watcher.stopWatching() // Should not crash
        XCTAssertFalse(watcher.isWatching)
    }

    func testAvailableInputDevices() {
        let devices = AudioDeviceWatcher.availableInputDevices()
        XCTAssertNotNil(devices) // Should return at least an empty array, never crash
    }
}
