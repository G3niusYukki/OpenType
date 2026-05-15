import Foundation

@MainActor
public class HealthMonitor {
    public static let shared = HealthMonitor()

    private var healthTimer: Timer?
    private let checkInterval: TimeInterval = 120 // 2 minutes
    private let staleRecordingTimeout: TimeInterval = 300 // 5 minutes

    /// Callback when a stale recording is detected.
    public var onStaleRecording: (() -> Void)?
    /// Callback when memory usage exceeds threshold.
    public var onHighMemory: ((Double) -> Void)?
    /// Callback for general health log entries.
    public var onHealthLog: ((String) -> Void)?

    private init() {}

    public func startMonitoring() {
        guard healthTimer == nil else { return }
        healthTimer = Timer.scheduledTimer(withTimeInterval: checkInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.performHealthCheck()
            }
        }
        onHealthLog?("HealthMonitor started (interval: \(Int(checkInterval))s)")
    }

    public func stopMonitoring() {
        healthTimer?.invalidate()
        healthTimer = nil
    }

    public func performHealthCheck() {
        // Check memory
        let memoryMB = currentMemoryPressureMB()
        if memoryMB > 200 { // 200 MB threshold for a menu bar app
            onHighMemory?(memoryMB)
            onHealthLog?("High memory: \(Int(memoryMB)) MB")
        }

        // Check recording state consistency — safe: both types are @MainActor
        let audioService = AudioCaptureService.shared
        if audioService.isRecording {
            let duration = audioService.getRecordingDuration()
            if duration > staleRecordingTimeout {
                onStaleRecording?()
                onHealthLog?("Stale recording detected: \(Int(duration))s")
            }
        }
    }

    public nonisolated func currentMemoryPressureMB() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        guard result == KERN_SUCCESS else { return 0 }
        return Double(info.resident_size) / (1024 * 1024)
    }

    public nonisolated func isRecordingStale(startTime: Date, timeout: TimeInterval) -> Bool {
        Date().timeIntervalSince(startTime) > timeout
    }
}
