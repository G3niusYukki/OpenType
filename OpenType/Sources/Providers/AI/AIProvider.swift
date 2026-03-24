import Foundation

public protocol AIProvider: Sendable {
    var name: String { get }
    func process(text: String, apiKey: String) async throws -> String
    func removeFillers(text: String, apiKey: String) async throws -> String
}
