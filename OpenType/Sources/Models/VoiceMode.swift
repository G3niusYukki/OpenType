import Foundation

public enum VoiceMode: String, CaseIterable, Identifiable, Codable {
    case basic
    case handsFree
    case translate
    case editSelected

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .basic: return "Basic"
        case .handsFree: return "Hands-Free"
        case .translate: return "Translate"
        case .editSelected: return "Edit"
        }
    }

    public var hotkeyDescription: String {
        switch self {
        case .basic: return "⌘⇧D"
        case .handsFree: return "⌘⇧Space"
        case .translate: return "⌘⇧T"
        case .editSelected: return "⌘⇧E"
        }
    }
}
