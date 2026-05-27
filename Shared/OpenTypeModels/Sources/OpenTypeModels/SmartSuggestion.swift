import Foundation

public struct SmartSuggestion: Identifiable {
    public let id: UUID
    public let detectedTerm: String
    public let suggestedReplacement: String
    public let frequency: Int
    public let context: String

    public init(id: UUID = UUID(), detectedTerm: String, suggestedReplacement: String, frequency: Int, context: String) {
        self.id = id
        self.detectedTerm = detectedTerm
        self.suggestedReplacement = suggestedReplacement
        self.frequency = frequency
        self.context = context
    }
}
