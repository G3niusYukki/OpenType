import Data
import Foundation
import Sparkle

class UpdaterDelegate: NSObject, SPUUpdaterDelegate {
    func updaterShouldPromptForPermission(toCheck _: SPUUpdater) -> Bool {
        return SettingsStore.shared.notificationsEnabled
    }
}
