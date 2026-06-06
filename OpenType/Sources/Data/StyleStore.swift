import Foundation
import Models
import SQLite
import Utilities

/// Manages style profiles, examples, tone rules, and per-app tone rules.
/// Extracted from HistoryStore to separate concerns. Shares the same SQLite database file.
public class StyleStore: @unchecked Sendable {
    public static let shared = StyleStore()

    private var db: Connection?

    // MARK: - Table definitions

    private let styleProfiles = Table("style_profiles")
    private let profileId = Expression<String>("id")
    private let profileName = Expression<String>("name")
    private let profileIsActive = Expression<Bool>("is_active")
    private let profileCreatedAt = Expression<Int64>("created_at")
    private let profileUpdatedAt = Expression<Int64>("updated_at")

    private let styleExamples = Table("style_examples")
    private let exampleId = Expression<String>("id")
    private let exampleRawText = Expression<String>("raw_text")
    private let examplePolishedText = Expression<String>("polished_text")
    private let exampleAppBundleID = Expression<String?>("app_bundle_id")
    private let exampleTimestamp = Expression<Int64>("timestamp")
    private let exampleProfileID = Expression<String>("profile_id")

    private let toneRules = Table("tone_rules")
    private let toneRuleId = Expression<String>("id")
    private let toneRuleDescription = Expression<String>("description_text")
    private let toneRuleInstructions = Expression<String>("instructions")
    private let toneRuleProfileID = Expression<String>("profile_id")

    private let appToneRules = Table("app_tone_rules")
    private let appToneRuleId = Expression<String>("id")
    private let appToneRuleBundleID = Expression<String>("bundle_id")
    private let appToneRuleAppName = Expression<String>("app_name")
    private let appToneRuleToneDescription = Expression<String>("tone_description")
    private let appToneRuleInstructions = Expression<String>("instructions")
    private let appToneRuleProfileID = Expression<String>("profile_id")

    private init() {
        setupDatabase()
    }

    private func setupDatabase() {
        do {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            let appDir = appSupport.appendingPathComponent(Constants.appBundleIdentifier)
            try FileManager.default.createDirectory(at: appDir, withIntermediateDirectories: true)
            let dbPath = appDir.appendingPathComponent(Constants.SQLite.databaseName).path
            db = try Connection(dbPath)
            try db?.execute("PRAGMA foreign_keys = ON")

            try db?.run(styleProfiles.create(ifNotExists: true) { t in
                t.column(profileId, primaryKey: true)
                t.column(profileName)
                t.column(profileIsActive)
                t.column(profileCreatedAt)
                t.column(profileUpdatedAt)
            })
            try db?.run(styleExamples.create(ifNotExists: true) { t in
                t.column(exampleId, primaryKey: true)
                t.column(exampleRawText)
                t.column(examplePolishedText)
                t.column(exampleAppBundleID)
                t.column(exampleTimestamp)
                t.column(exampleProfileID)
                t.foreignKey(exampleProfileID, references: styleProfiles, profileId, delete: .cascade)
            })
            try db?.run(toneRules.create(ifNotExists: true) { t in
                t.column(toneRuleId, primaryKey: true)
                t.column(toneRuleDescription)
                t.column(toneRuleInstructions)
                t.column(toneRuleProfileID)
                t.foreignKey(toneRuleProfileID, references: styleProfiles, profileId, delete: .cascade)
            })
            try db?.run(appToneRules.create(ifNotExists: true) { t in
                t.column(appToneRuleId, primaryKey: true)
                t.column(appToneRuleBundleID)
                t.column(appToneRuleAppName)
                t.column(appToneRuleToneDescription)
                t.column(appToneRuleInstructions)
                t.column(appToneRuleProfileID)
                t.foreignKey(appToneRuleProfileID, references: styleProfiles, profileId, delete: .cascade)
            })
        } catch {
            print("StyleStore setup failed: \(error)")
        }
    }

    // MARK: - StyleProfile CRUD

    public func getAllProfiles() throws -> [StyleProfile] {
        guard let db = db else { throw HistoryStoreError.databaseNotInitialized }
        return try db.prepare(styleProfiles).map { row in
            StyleProfile(
                id: UUID(uuidString: row[profileId]) ?? UUID(),
                name: row[profileName],
                isActive: row[profileIsActive],
                createdAt: Date(timeIntervalSince1970: TimeInterval(row[profileCreatedAt])),
                updatedAt: Date(timeIntervalSince1970: TimeInterval(row[profileUpdatedAt]))
            )
        }
    }

    public func saveProfile(_ profile: StyleProfile) throws {
        guard let db = db else { throw HistoryStoreError.databaseNotInitialized }
        try db.run(styleProfiles.insert(or: .replace,
                                        profileId <- profile.id.uuidString,
                                        profileName <- profile.name,
                                        profileIsActive <- profile.isActive,
                                        profileCreatedAt <- Int64(profile.createdAt.timeIntervalSince1970),
                                        profileUpdatedAt <- Int64(profile.updatedAt.timeIntervalSince1970)))
    }

    public func deleteProfile(_ profileID: UUID) throws {
        guard let db = db else { return }
        try db.run(styleProfiles.filter(profileId == profileID.uuidString).delete())
    }

    // MARK: - StyleExample CRUD

    public func getExamples(for profileID: UUID) throws -> [StyleExample] {
        guard let db = db else { throw HistoryStoreError.databaseNotInitialized }
        return try db.prepare(styleExamples.filter(exampleProfileID == profileID.uuidString)).map { row in
            StyleExample(
                id: UUID(uuidString: row[exampleId]) ?? UUID(),
                rawText: row[exampleRawText],
                polishedText: row[examplePolishedText],
                appBundleID: row[exampleAppBundleID],
                timestamp: Date(timeIntervalSince1970: TimeInterval(row[exampleTimestamp])),
                profileID: UUID(uuidString: row[exampleProfileID]) ?? profileID
            )
        }
    }

    public func saveExample(_ example: StyleExample) throws {
        guard let db = db else { throw HistoryStoreError.databaseNotInitialized }
        try db.run(styleExamples.insert(or: .replace,
                                        exampleId <- example.id.uuidString,
                                        exampleRawText <- example.rawText,
                                        examplePolishedText <- example.polishedText,
                                        exampleAppBundleID <- example.appBundleID,
                                        exampleTimestamp <- Int64(example.timestamp.timeIntervalSince1970),
                                        exampleProfileID <- example.profileID.uuidString))
    }

    public func deleteExample(_ exampleID: UUID) throws {
        guard let db = db else { return }
        try db.run(styleExamples.filter(exampleId == exampleID.uuidString).delete())
    }

    // MARK: - ToneRule CRUD

    public func getToneRules(for profileID: UUID) throws -> [ToneRule] {
        guard let db = db else { throw HistoryStoreError.databaseNotInitialized }
        return try db.prepare(toneRules.filter(toneRuleProfileID == profileID.uuidString)).map { row in
            ToneRule(
                id: UUID(uuidString: row[toneRuleId]) ?? UUID(),
                description: row[toneRuleDescription],
                instructions: row[toneRuleInstructions],
                profileID: UUID(uuidString: row[toneRuleProfileID]) ?? profileID
            )
        }
    }

    public func saveToneRule(_ rule: ToneRule) throws {
        guard let db = db else { throw HistoryStoreError.databaseNotInitialized }
        try db.run(toneRules.insert(or: .replace,
                                    toneRuleId <- rule.id.uuidString,
                                    toneRuleDescription <- rule.description,
                                    toneRuleInstructions <- rule.instructions,
                                    toneRuleProfileID <- rule.profileID.uuidString))
    }

    public func deleteToneRule(_ ruleID: UUID) throws {
        guard let db = db else { return }
        try db.run(toneRules.filter(toneRuleId == ruleID.uuidString).delete())
    }

    // MARK: - AppToneRule CRUD

    public func getAppToneRules(for profileID: UUID) throws -> [AppToneRule] {
        guard let db = db else { throw HistoryStoreError.databaseNotInitialized }
        return try db.prepare(appToneRules.filter(appToneRuleProfileID == profileID.uuidString)).map { row in
            AppToneRule(
                id: UUID(uuidString: row[appToneRuleId]) ?? UUID(),
                bundleID: row[appToneRuleBundleID],
                appName: row[appToneRuleAppName],
                toneDescription: row[appToneRuleToneDescription],
                instructions: row[appToneRuleInstructions],
                profileID: UUID(uuidString: row[appToneRuleProfileID]) ?? profileID
            )
        }
    }

    public func saveAppToneRule(_ rule: AppToneRule) throws {
        guard let db = db else { throw HistoryStoreError.databaseNotInitialized }
        try db.run(appToneRules.insert(or: .replace,
                                       appToneRuleId <- rule.id.uuidString,
                                       appToneRuleBundleID <- rule.bundleID,
                                       appToneRuleAppName <- rule.appName,
                                       appToneRuleToneDescription <- rule.toneDescription,
                                       appToneRuleInstructions <- rule.instructions,
                                       appToneRuleProfileID <- rule.profileID.uuidString))
    }

    public func deleteAppToneRule(_ ruleID: UUID) throws {
        guard let db = db else { return }
        try db.run(appToneRules.filter(appToneRuleId == ruleID.uuidString).delete())
    }
}
