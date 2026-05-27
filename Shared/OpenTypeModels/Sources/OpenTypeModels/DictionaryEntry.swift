import Foundation

public struct DictionaryEntry: Identifiable, Codable {
    public let id: String
    public let term: String
    public let replacement: String
    public let category: String

    public init(id: String, term: String, replacement: String, category: String) {
        self.id = id
        self.term = term
        self.replacement = replacement
        self.category = category
    }
}
