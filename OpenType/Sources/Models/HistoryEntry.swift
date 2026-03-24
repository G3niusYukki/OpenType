import Foundation

public struct HistoryEntry: Identifiable, Codable {
    public let id: UUID
    public let audioPath: String
    public let originalText: String
    public let processedText: String
    public let mode: VoiceMode
    public let provider: String
    public let createdAt: Date
    public let duration: TimeInterval
    public let language: String

    public init(id: UUID = UUID(), audioPath: String, originalText: String, processedText: String, mode: VoiceMode, provider: String, createdAt: Date = Date(), duration: TimeInterval, language: String) {
        self.id = id
        self.audioPath = audioPath
        self.originalText = originalText
        self.processedText = processedText
        self.mode = mode
        self.provider = provider
        self.createdAt = createdAt
        self.duration = duration
        self.language = language
    }
}
