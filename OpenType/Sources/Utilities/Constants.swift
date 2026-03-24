import Foundation
import CoreGraphics

public enum Constants {
    public static let appBundleIdentifier = "com.opentype.macos"
    public static let appName = "OpenType"
    public static let appVersion = "0.1.0"

    public enum Keychain {
        public static let service = "com.opentype.macos"
    }

    public enum UserDefaults {
        public static let suiteName = "com.opentype.macos"
        public static let selectedTranscriptionProvider = "selectedTranscriptionProvider"
        public static let selectedAIProvider = "selectedAIProvider"
        public static let launchAtLogin = "launchAtLogin"
        public static let notificationsEnabled = "notificationsEnabled"
        public static let lastProfileID = "lastProfileID"
    }

    public enum SQLite {
        public static let databaseName = "opentype.sqlite3"
    }

    public enum Hotkeys {
        public static let defaultBasic = (keyCode: CGKeyCode(2), modifiers: CGEventFlags.maskCommand.union(.maskShift)) // D
        public static let defaultHandsFree = (keyCode: CGKeyCode(49), modifiers: CGEventFlags.maskCommand.union(.maskShift)) // Space
        public static let defaultTranslate = (keyCode: CGKeyCode(17), modifiers: CGEventFlags.maskCommand.union(.maskShift)) // T
        public static let defaultEditSelected = (keyCode: CGKeyCode(14), modifiers: CGEventFlags.maskCommand.union(.maskShift)) // E
    }

    public enum UI {
        public static let popoverWidth: CGFloat = 320
        public static let popoverHeight: CGFloat = 400
        public static let mainWindowWidth: CGFloat = 600
        public static let mainWindowHeight: CGFloat = 500
        public static let settingsWindowWidth: CGFloat = 650
        public static let settingsWindowHeight: CGFloat = 550
        public static let diagnosticsWindowWidth: CGFloat = 500
        public static let diagnosticsWindowHeight: CGFloat = 400
    }
}
