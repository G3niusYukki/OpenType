import Foundation

public enum AIError: Error, LocalizedError {
    case requestFailed
    case invalidResponse
    case apiKeyMissing

    public var errorDescription: String? {
        switch self {
        case .requestFailed: return "AI request failed"
        case .invalidResponse: return "Invalid AI response"
        case .apiKeyMissing: return "API key missing"
        }
    }
}
