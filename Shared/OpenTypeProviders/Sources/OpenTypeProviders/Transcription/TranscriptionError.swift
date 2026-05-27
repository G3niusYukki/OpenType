     1|import Foundation
     2|
     3|public enum TranscriptionError: Error, LocalizedError {
     4|    case speechPermissionDenied
     5|    case recognitionFailed
     6|    case noResult
     7|    case providerUnavailable
     8|    case invalidCredentials
     9|    case quotaExceeded
    10|
    11|    public var errorDescription: String? {
    12|        switch self {
    13|        case .speechPermissionDenied: return "Speech recognition permission denied"
    14|        case .recognitionFailed: return "Speech recognition failed"
    15|        case .noResult: return "No transcription result"
    16|        case .providerUnavailable: return "Transcription provider unavailable"
    17|        case .invalidCredentials: return "Invalid credentials"
    18|        case .quotaExceeded: return "API quota exceeded"
    19|        }
    20|    }
    21|}
    22|