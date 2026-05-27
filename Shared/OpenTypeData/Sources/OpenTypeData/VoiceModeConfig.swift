import Foundation

public struct VoiceModeConfig: Codable {
    public var enabled: Bool
    public var hotkeyKeyCode: Int?
    public var hotkeyModifiers: UInt?
    public var sourceLanguage: String?
    public var targetLanguage: String?
    public var autoDetectLanguage: Bool

    enum CodingKeys: String, CodingKey {
        case enabled
        case hotkeyKeyCode
        case hotkeyModifiers
        case sourceLanguage
        case targetLanguage
        case autoDetectLanguage
    }

    public init(enabled: Bool = true, hotkeyKeyCode: Int? = nil, hotkeyModifiers: UInt? = nil, sourceLanguage: String? = nil, targetLanguage: String? = nil, autoDetectLanguage: Bool = true) {
        self.enabled = enabled
        self.hotkeyKeyCode = hotkeyKeyCode
        self.hotkeyModifiers = hotkeyModifiers
        self.sourceLanguage = sourceLanguage
        self.targetLanguage = targetLanguage
        self.autoDetectLanguage = autoDetectLanguage
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        hotkeyKeyCode = try container.decodeIfPresent(Int.self, forKey: .hotkeyKeyCode)
        hotkeyModifiers = try container.decodeIfPresent(UInt.self, forKey: .hotkeyModifiers)
        sourceLanguage = try container.decodeIfPresent(String.self, forKey: .sourceLanguage)
        targetLanguage = try container.decodeIfPresent(String.self, forKey: .targetLanguage)
        autoDetectLanguage = try container.decodeIfPresent(Bool.self, forKey: .autoDetectLanguage) ?? true
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(enabled, forKey: .enabled)
        try container.encodeIfPresent(hotkeyKeyCode, forKey: .hotkeyKeyCode)
        try container.encodeIfPresent(hotkeyModifiers, forKey: .hotkeyModifiers)
        try container.encodeIfPresent(sourceLanguage, forKey: .sourceLanguage)
        try container.encodeIfPresent(targetLanguage, forKey: .targetLanguage)
        try container.encode(autoDetectLanguage, forKey: .autoDetectLanguage)
    }
}
