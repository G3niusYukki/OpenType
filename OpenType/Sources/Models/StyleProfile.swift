import Foundation

public struct StyleProfile: Identifiable, Codable, Equatable {
    public let id: UUID
    public var name: String
    public var isActive: Bool
    public let createdAt: Date
    public var updatedAt: Date

    public init(id: UUID = UUID(), name: String, isActive: Bool = false,
                createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.name = name
        self.isActive = isActive
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct StyleExample: Identifiable, Codable, Equatable {
    public let id: UUID
    public let rawText: String
    public let polishedText: String
    public let appBundleID: String?
    public let timestamp: Date
    public let profileID: UUID

    public init(id: UUID = UUID(), rawText: String, polishedText: String,
                appBundleID: String? = nil, timestamp: Date = Date(), profileID: UUID) {
        self.id = id
        self.rawText = rawText
        self.polishedText = polishedText
        self.appBundleID = appBundleID
        self.timestamp = timestamp
        self.profileID = profileID
    }
}

public struct ToneRule: Identifiable, Codable, Equatable {
    public let id: UUID
    public var description: String
    public var instructions: String
    public let profileID: UUID

    public init(id: UUID = UUID(), description: String, instructions: String, profileID: UUID) {
        self.id = id
        self.description = description
        self.instructions = instructions
        self.profileID = profileID
    }
}

public struct AppToneRule: Identifiable, Codable, Equatable {
    public let id: UUID
    public let bundleID: String
    public var appName: String
    public var toneDescription: String
    public var instructions: String
    public let profileID: UUID

    public init(id: UUID = UUID(), bundleID: String, appName: String,
                toneDescription: String, instructions: String, profileID: UUID) {
        self.id = id
        self.bundleID = bundleID
        self.appName = appName
        self.toneDescription = toneDescription
        self.instructions = instructions
        self.profileID = profileID
    }
}

public enum TonePreset: String, Codable, CaseIterable {
    case professional
    case casual
    case concise
    case creative
    case academic

    public var key: String { rawValue }

    public var localizedName: String {
        switch self {
        case .professional: return NSLocalizedString("tone.professional", value: "Professional", comment: "")
        case .casual: return NSLocalizedString("tone.casual", value: "Casual", comment: "")
        case .concise: return NSLocalizedString("tone.concise", value: "Concise", comment: "")
        case .creative: return NSLocalizedString("tone.creative", value: "Creative", comment: "")
        case .academic: return NSLocalizedString("tone.academic", value: "Academic", comment: "")
        }
    }

    public var instructions: String {
        switch self {
        case .professional: return "Write in a formal, professional tone suitable for business communication"
        case .casual: return "Write in a relaxed, conversational tone as if texting a friend"
        case .concise: return "Be brief and direct. Remove unnecessary words"
        case .creative: return "Use vivid, expressive language. Be creative with word choice"
        case .academic: return "Write in a scholarly tone with precise terminology"
        }
    }
}
