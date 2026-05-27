import Foundation

public struct DiagnosticResult: Identifiable {
    public var id: String { name }
    public let name: String
    public let status: DiagnosticStatus
    public let details: String
    public let suggestion: String?

    public init(name: String, status: DiagnosticStatus, details: String, suggestion: String? = nil) {
        self.name = name
        self.status = status
        self.details = details
        self.suggestion = suggestion
    }
}

public enum DiagnosticStatus {
    case pass, fail, warning, skipped

    public var colorName: String {
        switch self {
        case .pass: return "green"
        case .fail: return "red"
        case .warning: return "orange"
        case .skipped: return "gray"
        }
    }
}
