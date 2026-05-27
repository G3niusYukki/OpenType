import Foundation

public struct Profile: Identifiable, Equatable, Codable {
    public let id: UUID
    public let name: String
    public let transcriptionProvider: String
    public let aiProvider: String
    public let isDefault: Bool

    public init(id: UUID = UUID(), name: String, transcriptionProvider: String, aiProvider: String, isDefault: Bool = false) {
        self.id = id
        self.name = name
        self.transcriptionProvider = transcriptionProvider
        self.aiProvider = aiProvider
        self.isDefault = isDefault
    }
}
