import Foundation
import Sparkle
import Data

class UpdaterDelegate: NSObject, SUUpdaterDelegate {
    func updater(_ updater: SUUpdater, shouldScheduleUpdateCheck date: Date?) -> Bool {
        return true
    }

    func updaterShouldPromptForPermission(toCheck updater: SUUpdater) -> Bool {
        return SettingsStore.shared.notificationsEnabled
    }
}
