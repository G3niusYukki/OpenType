import UserNotifications
import AppKit
import Data
import Utilities

public class NotificationService {
    public static let shared = NotificationService()

    private init() {}

    public func requestPermission() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound])
        } catch {
            print("Notification permission error: \(error)")
            return false
        }
    }

    public func notifyTranscriptionComplete(text: String) {
        guard SettingsStore.shared.notificationsEnabled else { return }

        let content = UNMutableNotificationContent()
        content.title = "转写完成"
        content.body = String(text.prefix(100)) + (text.count > 100 ? "..." : "")
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Failed to send notification: \(error)")
            }
        }
    }

    // MARK: - Sound Feedback

    public func playRecordingStartSound() {
        guard SettingsStore.shared.soundFeedbackEnabled else { return }
        NSSound(named: "Tink")?.play()
    }

    public func playRecordingStopSound() {
        guard SettingsStore.shared.soundFeedbackEnabled else { return }
        NSSound(named: "Pop")?.play()
    }
}
