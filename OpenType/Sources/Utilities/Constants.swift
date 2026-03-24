import Foundation
import CoreGraphics

enum Constants {
    static let appBundleIdentifier = "com.opentype.macos"
    static let appName = "OpenType"
    static let appVersion = "0.1.0"

    enum Keychain {
        static let service = "com.opentype.macos"
    }

    enum UserDefaults {
        static let suiteName = "com.opentype.macos"
        static let selectedTranscriptionProvider = "selectedTranscriptionProvider"
        static let selectedAIProvider = "selectedAIProvider"
        static let launchAtLogin = "launchAtLogin"
        static let notificationsEnabled = "notificationsEnabled"
        static let lastProfileID = "lastProfileID"
    }

    enum SQLite {
        static let databaseName = "opentype.sqlite3"
    }

    enum Hotkeys {
        static let defaultBasic = (keyCode: CGKeyCode(2), modifiers: CGEventFlags.maskCommand.union(.maskShift)) // D
        static let defaultHandsFree = (keyCode: CGKeyCode(49), modifiers: CGEventFlags.maskCommand.union(.maskShift)) // Space
        static let defaultTranslate = (keyCode: CGKeyCode(17), modifiers: CGEventFlags.maskCommand.union(.maskShift)) // T
        static let defaultEditSelected = (keyCode: CGKeyCode(14), modifiers: CGEventFlags.maskCommand.union(.maskShift)) // E
    }

    enum UI {
        static let popoverWidth: CGFloat = 320
        static let popoverHeight: CGFloat = 400
        static let mainWindowWidth: CGFloat = 600
        static let mainWindowHeight: CGFloat = 500
        static let settingsWindowWidth: CGFloat = 650
        static let settingsWindowHeight: CGFloat = 550
        static let diagnosticsWindowWidth: CGFloat = 500
        static let diagnosticsWindowHeight: CGFloat = 400
    }
}
