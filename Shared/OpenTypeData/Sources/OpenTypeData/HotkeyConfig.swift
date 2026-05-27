import Foundation

public struct HotkeyConfig: Codable {
    public let keyCode: Int
    public let modifiers: UInt

    public init(keyCode: Int, modifiers: UInt) {
        self.keyCode = keyCode
        self.modifiers = modifiers
    }
}
