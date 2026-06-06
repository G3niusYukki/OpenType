@testable import Services
import XCTest

final class HealthMonitorTests: XCTestCase {
    func testMemoryPressureCalculation() {
        // currentMemoryPressureMB is nonisolated — safe to call from any context
        let monitor = HealthMonitor.shared
        let pressure = monitor.currentMemoryPressureMB()
        // Should return a non-negative number
        XCTAssertGreaterThanOrEqual(pressure, 0)
    }

    func testStaleRecordingDetection() {
        // isRecordingStale is nonisolated — safe to call from any context
        let monitor = HealthMonitor.shared
        let staleStart = Date().addingTimeInterval(-600)
        XCTAssertTrue(monitor.isRecordingStale(startTime: staleStart, timeout: 300))

        let freshStart = Date().addingTimeInterval(-30)
        XCTAssertFalse(monitor.isRecordingStale(startTime: freshStart, timeout: 300))
    }

    @MainActor
    func testHealthCheckDoesNotCrash() {
        let monitor = HealthMonitor.shared
        // performHealthCheck is @MainActor — call from MainActor context
        monitor.performHealthCheck()
        XCTAssertTrue(true)
    }
}
