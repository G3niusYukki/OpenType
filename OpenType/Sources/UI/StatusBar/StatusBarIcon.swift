import AppKit

public enum StatusBarIcon {
    case idle
    case recording
    case processing
    case error

    public var symbolName: String {
        switch self {
        case .idle: return "mic.fill"
        case .recording: return "mic.fill"
        case .processing: return "arrow.triangle.2.circlepath"
        case .error: return "exclamationmark.mic.fill"
        }
    }

    public var tintColor: NSColor {
        switch self {
        case .idle: return .secondaryLabelColor
        case .recording: return .systemRed
        case .processing: return .systemBlue
        case .error: return .systemOrange
        }
    }
}
