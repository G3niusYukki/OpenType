import Foundation
import Sparkle
import Data

class UpdaterDelegate: NSObject, SPUUpdaterDelegate {
    func updaterShouldPromptForPermission(toCheck updater: SPUUpdater) -> Bool {
        return SettingsStore.shared.notificationsEnabled
    }
}
