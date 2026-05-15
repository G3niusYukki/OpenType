import Foundation

public enum AIError: Error, LocalizedError {
    case requestFailed
    case apiKeyNotFound
    case invalidResponse

    public var errorDescription: String? {
        switch self {
        case .requestFailed: return "AI request failed"
        case .invalidResponse: return "Invalid AI response"
        case .apiKeyNotFound: return "API key not found"
        }
    }
}
