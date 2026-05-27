import Foundation
import SQLite
import OpenTypeModels
import OpenTypeCore

public enum HistoryStoreError: Error {
    case databaseNotInitialized
}

public class HistoryStore: @unchecked Sendable {
    public static let shared = HistoryStore()

    private var db: Connection?

    private let history = Table("history")
    private let id = Expression<String>("id")
    private let audioPath = Expression<String>("audio_path")
    private let originalText = Expression<String>("original_text")
    private let processedText = Expression<String>("processed_text")
    private let mode = Expression<String>("mode")
    private let provider = Expression<String>("provider")
    private let createdAt = Expression<Int64>("created_at")
    private let duration = Expression<Double>("duration")
    private let language = Expression<String>("language")
    private let appBundleID = Expression<String?>("app_bundle_id")

    private let dictionary = Table("dictionary")
    private let termId = Expression<String>("id")
    private let term = Expression<String>("term")
    private let replacement = Expression<String>("replacement")
    private let category = Expression<String>("category")

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

            try createTables()
            try migrateHistoryTable()
        } catch {
            print("Database setup failed: \(error)")
        }
    }

    public func close() {
        db = nil
    }

    private func createTables() throws {
        guard let db = db else { return }

        try db.run(history.create(ifNotExists: true) { t in
            t.column(id, primaryKey: true)
            t.column(audioPath)
            t.column(originalText)
            t.column(processedText)
            t.column(mode)
            t.column(provider)
            t.column(createdAt)
            t.column(duration)
            t.column(language)
            t.column(appBundleID)
        })

        try db.run(dictionary.create(ifNotExists: true) { t in
            t.column(termId, primaryKey: true)
            t.column(term)
            t.column(replacement)
            t.column(category)
        })

        try db.run(styleProfiles.create(ifNotExists: true) { t in
            t.column(profileId, primaryKey: true)
            t.column(profileName)
            t.column(profileIsActive)
            t.column(profileCreatedAt)
            t.column(profileUpdatedAt)
        })

        try db.run(styleExamples.create(ifNotExists: true) { t in
            t.column(exampleId, primaryKey: true)
            t.column(exampleRawText)
            t.column(examplePolishedText)
            t.column(exampleAppBundleID)
            t.column(exampleTimestamp)
            t.column(exampleProfileID)
            t.foreignKey(exampleProfileID, references: styleProfiles, profileId, delete: .cascade)
        })

        try db.run(toneRules.create(ifNotExists: true) { t in
            t.column(toneRuleId, primaryKey: true)
            t.column(toneRuleDescription)
            t.column(toneRuleInstructions)
            t.column(toneRuleProfileID)
            t.foreignKey(toneRuleProfileID, references: styleProfiles, profileId, delete: .cascade)
        })

        try db.run(appToneRules.create(ifNotExists: true) { t in
            t.column(appToneRuleId, primaryKey: true)
            t.column(appToneRuleBundleID)
            t.column(appToneRuleAppName)
            t.column(appToneRuleToneDescription)
            t.column(appToneRuleInstructions)
            t.column(appToneRuleProfileID)
            t.foreignKey(appToneRuleProfileID, references: styleProfiles, profileId, delete: .cascade)
        })
    }

    private func migrateHistoryTable() throws {
        guard let db = db else { return }

        let columns = try db.prepare("PRAGMA table_info(history)")
        var hasAppBundleID = false
        for row in columns {
            if let name = row[1] as? String, name == "app_bundle_id" {
                hasAppBundleID = true
                break
            }
        }

        if !hasAppBundleID {
            try db.execute("ALTER TABLE history ADD COLUMN app_bundle_id TEXT")
        }
    }

    // MARK: - History CRUD

    public func saveHistoryEntry(_ entry: HistoryEntry) throws {
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

        let insert = history.insert(
            id <- entry.id.uuidString,
            audioPath <- entry.audioPath,
            originalText <- entry.originalText,
            processedText <- entry.processedText,
            mode <- entry.mode.rawValue,
            provider <- entry.provider,
            createdAt <- Int64(entry.createdAt.timeIntervalSince1970),
            duration <- entry.duration,
            language <- entry.language,
            appBundleID <- entry.appBundleID
        )

        try db.run(insert)
    }

    public func getAllHistory() -> [HistoryEntry] {
        guard let db = db else { return [] }

        do {
            return try db.prepare(history.order(createdAt.desc)).map { row in
                HistoryEntry(
                    id: UUID(uuidString: row[id]) ?? UUID(),
                    audioPath: row[audioPath],
                    originalText: row[originalText],
                    processedText: row[processedText],
                    mode: VoiceMode(rawValue: row[mode]) ?? .basic,
                    provider: row[provider],
                    createdAt: Date(timeIntervalSince1970: TimeInterval(row[createdAt])),
                    duration: row[duration],
                    language: row[language],
                    appBundleID: row[appBundleID]
                )
            }
        } catch {
            print("Failed to fetch history: \(error)")
            return []
        }
    }

    public func getRecentHistory(limit: Int = 5) -> [HistoryEntry] {
        guard let db = db else { return [] }

        do {
            return try db.prepare(history.order(createdAt.desc).limit(limit)).map { row in
                HistoryEntry(
                    id: UUID(uuidString: row[id]) ?? UUID(),
                    audioPath: row[audioPath],
                    originalText: row[originalText],
                    processedText: row[processedText],
                    mode: VoiceMode(rawValue: row[mode]) ?? .basic,
                    provider: row[provider],
                    createdAt: Date(timeIntervalSince1970: TimeInterval(row[createdAt])),
                    duration: row[duration],
                    language: row[language],
                    appBundleID: row[appBundleID]
                )
            }
        } catch {
            print("Failed to fetch recent history: \(error)")
            return []
        }
    }

    public func deleteHistoryEntry(id entryId: UUID) throws {
        guard let db = db else { return }
        let entry = history.filter(id == entryId.uuidString)
        try db.run(entry.delete())
    }

    public func clearAllHistory() throws {
        guard let db = db else { return }
        try db.run(history.delete())
    }

    // MARK: - Dictionary CRUD

    public func saveDictionaryEntry(term t: String, replacement r: String, category c: String) throws {
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

        let insert = dictionary.insert(or: .replace,
            termId <- UUID().uuidString,
            term <- t,
            replacement <- r,
            category <- c
        )
        try db.run(insert)
    }

    public func getAllDictionaryEntries() -> [DictionaryEntry] {
        guard let db = db else { return [] }

        do {
            return try db.prepare(dictionary).map { row in
                DictionaryEntry(id: row[termId], term: row[term], replacement: row[replacement], category: row[category])
            }
        } catch {
            print("Failed to fetch dictionary: \(error)")
            return []
        }
    }

    public func deleteDictionaryEntry(id entryId: String) throws {
        guard let db = db else { return }
        let entry = dictionary.filter(termId == entryId)
        try db.run(entry.delete())
    }

    // MARK: - StyleProfile CRUD

    public func getAllStyleProfiles() throws -> [StyleProfile] {
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

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

    public func saveStyleProfile(_ profile: StyleProfile) throws {
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

        let insert = styleProfiles.insert(or: .replace,
            profileId <- profile.id.uuidString,
            profileName <- profile.name,
            profileIsActive <- profile.isActive,
            profileCreatedAt <- Int64(profile.createdAt.timeIntervalSince1970),
            profileUpdatedAt <- Int64(profile.updatedAt.timeIntervalSince1970)
        )
        try db.run(insert)
    }

    public func deleteStyleProfile(_ profileID: UUID) throws {
        guard let db = db else { return }
        let profile = styleProfiles.filter(profileId == profileID.uuidString)
        try db.run(profile.delete())
    }

    // MARK: - StyleExample CRUD

    public func getStyleExamples(for profileID: UUID) throws -> [StyleExample] {
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

        let query = styleExamples.filter(exampleProfileID == profileID.uuidString)
        return try db.prepare(query).map { row in
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

    public func saveStyleExample(_ example: StyleExample) throws {
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

        let insert = styleExamples.insert(or: .replace,
            exampleId <- example.id.uuidString,
            exampleRawText <- example.rawText,
            examplePolishedText <- example.polishedText,
            exampleAppBundleID <- example.appBundleID,
            exampleTimestamp <- Int64(example.timestamp.timeIntervalSince1970),
            exampleProfileID <- example.profileID.uuidString
        )
        try db.run(insert)
    }

    public func deleteStyleExample(_ exampleID: UUID) throws {
        guard let db = db else { return }
        let example = styleExamples.filter(exampleId == exampleID.uuidString)
        try db.run(example.delete())
    }

    // MARK: - ToneRule CRUD

    public func getToneRules(for profileID: UUID) throws -> [ToneRule] {
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

        let query = toneRules.filter(toneRuleProfileID == profileID.uuidString)
        return try db.prepare(query).map { row in
            ToneRule(
                id: UUID(uuidString: row[toneRuleId]) ?? UUID(),
                description: row[toneRuleDescription],
                instructions: row[toneRuleInstructions],
                profileID: UUID(uuidString: row[toneRuleProfileID]) ?? profileID
            )
        }
    }

    public func saveToneRule(_ rule: ToneRule) throws {
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

        let insert = toneRules.insert(or: .replace,
            toneRuleId <- rule.id.uuidString,
            toneRuleDescription <- rule.description,
            toneRuleInstructions <- rule.instructions,
            toneRuleProfileID <- rule.profileID.uuidString
        )
        try db.run(insert)
    }

    public func deleteToneRule(_ ruleID: UUID) throws {
        guard let db = db else { return }
        let rule = toneRules.filter(toneRuleId == ruleID.uuidString)
        try db.run(rule.delete())
    }

    // MARK: - AppToneRule CRUD

    public func getAppToneRules(for profileID: UUID) throws -> [AppToneRule] {
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

        let query = appToneRules.filter(appToneRuleProfileID == profileID.uuidString)
        return try db.prepare(query).map { row in
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
        guard let db = db else {
            throw HistoryStoreError.databaseNotInitialized
        }

        let insert = appToneRules.insert(or: .replace,
            appToneRuleId <- rule.id.uuidString,
            appToneRuleBundleID <- rule.bundleID,
            appToneRuleAppName <- rule.appName,
            appToneRuleToneDescription <- rule.toneDescription,
            appToneRuleInstructions <- rule.instructions,
            appToneRuleProfileID <- rule.profileID.uuidString
        )
        try db.run(insert)
    }

    public func deleteAppToneRule(_ ruleID: UUID) throws {
        guard let db = db else { return }
        let rule = appToneRules.filter(appToneRuleId == ruleID.uuidString)
        try db.run(rule.delete())
    }
}
