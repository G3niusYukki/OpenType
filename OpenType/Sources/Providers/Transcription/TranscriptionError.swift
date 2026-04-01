import Foundation

public enum TranscriptionError: Error, LocalizedError {
    case speechPermissionDenied
    case recognitionFailed
    case noResult
    case providerUnavailable
    case invalidCredentials
    case quotaExceeded

    public var errorDescription: String? {
        switch self {
        case .speechPermissionDenied: return "Speech recognition permission denied"
        case .recognitionFailed: return "Speech recognition failed"
        case .noResult: return "No transcription result"
        case .providerUnavailable: return "Transcription provider unavailable"
        case .invalidCredentials: return "Invalid credentials"
        case .quotaExceeded: return "API quota exceeded"
        }
    }
}
