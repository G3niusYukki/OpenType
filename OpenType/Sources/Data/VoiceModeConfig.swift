import Foundation

public struct VoiceModeConfig: Codable {
    public var enabled: Bool
    public var hotkeyKeyCode: Int?
    public var hotkeyModifiers: UInt?
    public var sourceLanguage: String?
    public var targetLanguage: String?

    public init(enabled: Bool = true, hotkeyKeyCode: Int? = nil, hotkeyModifiers: UInt? = nil, sourceLanguage: String? = nil, targetLanguage: String? = nil) {
        self.enabled = enabled
        self.hotkeyKeyCode = hotkeyKeyCode
        self.hotkeyModifiers = hotkeyModifiers
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
    }
}
