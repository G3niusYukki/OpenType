     1|import Foundation
     2|
     3|public enum AIError: Error, LocalizedError {
     4|    case requestFailed
     5|    case apiKeyNotFound
     6|    case invalidResponse
     7|
     8|    public var errorDescription: String? {
     9|        switch self {
    10|        case .requestFailed: return "AI request failed"
    11|        case .invalidResponse: return "Invalid AI response"
    12|        case .apiKeyNotFound: return "API key not found"
    13|        }
    14|    }
    15|}
    16|