import Foundation
import SQLite
import Models
import Utilities

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

    private let dictionary = Table("dictionary")
    private let termId = Expression<String>("id")
    private let term = Expression<String>("term")
    private let replacement = Expression<String>("replacement")
    private let category = Expression<String>("category")

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

            try createTables()
        } catch {
            print("Database setup failed: \(error)")
        }
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
        })

        try db.run(dictionary.create(ifNotExists: true) { t in
            t.column(termId, primaryKey: true)
            t.column(term)
            t.column(replacement)
            t.column(category)
        })
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
            language <- entry.language
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
                    language: row[language]
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
                    language: row[language]
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
}
