import Foundation

public struct TranscriptionResult {
    public let text: String
    public let language: String?
    public let confidence: Float?
    public let segments: [TranscriptionSegment]?
    public let duration: TimeInterval
    public let provider: String

    public init(text: String, language: String?, confidence: Float?, segments: [TranscriptionSegment]?, duration: TimeInterval, provider: String) {
        self.text = text
        self.language = language
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
