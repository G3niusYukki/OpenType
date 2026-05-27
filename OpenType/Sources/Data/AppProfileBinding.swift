import Foundation

public struct AppProfileBinding: Codable, Identifiable, Hashable, Equatable {
    public let id: UUID
    public var bundleID: String
    public var appName: String
    public var profileID: UUID
    public var createdAt: Date

    public init(id: UUID = UUID(), bundleID: String, appName: String, profileID: UUID, createdAt: Date = Date()) {
        self.id = id
        self.bundleID = bundleID
        self.appName = appName
        self.profileID = profileID
        self.createdAt = createdAt
    }
}
