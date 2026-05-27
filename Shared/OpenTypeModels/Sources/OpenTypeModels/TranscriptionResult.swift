import Foundation

public struct TranscriptionResult {
    public let text: String
    public let language: String?
    public let detectedLanguage: String?
    public let confidence: Float?
    public let segments: [TranscriptionSegment]?
    public let duration: TimeInterval
    public let provider: String

    public init(text: String, language: String?, detectedLanguage: String? = nil, confidence: Float? = nil, segments: [TranscriptionSegment]? = nil, duration: TimeInterval = 0, provider: String) {
        self.text = text
        self.language = language
        self.detectedLanguage = detectedLanguage
        self.confidence = confidence
        self.segments = segments
        self.duration = duration
        self.provider = provider
    }

    public struct TranscriptionSegment {
        public let text: String
        public let startTime: TimeInterval
        public let endTime: TimeInterval

        public init(text: String, startTime: TimeInterval, endTime: TimeInterval) {
            self.text = text
            self.startTime = startTime
            self.endTime = endTime
        }
    }
}
