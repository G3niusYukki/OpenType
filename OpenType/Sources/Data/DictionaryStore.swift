import Foundation
import Models
import SQLite
import Utilities

/// Manages the user dictionary — custom term→replacement mappings for transcription correction.
/// Extracted from HistoryStore to separate concerns. Shares the same SQLite database file.
public class DictionaryStore: @unchecked Sendable {
    public static let shared = DictionaryStore()

    private var db: Connection?

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

            try db?.run(dictionary.create(ifNotExists: true) { t in
                t.column(termId, primaryKey: true)
                t.column(term)
                t.column(replacement)
                t.column(category)
            })
        } catch {
            print("DictionaryStore setup failed: \(error)")
        }
    }

    // MARK: - CRUD

    public func saveEntry(term t: String, replacement r: String, category c: String) throws {
        guard let db = db else { throw HistoryStoreError.databaseNotInitialized }

        let insert = dictionary.insert(or: .replace,
                                       termId <- UUID().uuidString,
                                       term <- t,
                                       replacement <- r,
                                       category <- c)
        try db.run(insert)
    }

    public func getAllEntries() -> [DictionaryEntry] {
        guard let db = db else { return [] }

        do {
            return try db.prepare(dictionary).map { row in
                DictionaryEntry(
                    id: row[termId],
                    term: row[term],
                    replacement: row[replacement],
                    category: row[category]
                )
            }
        } catch {
            print("Failed to fetch dictionary: \(error)")
            return []
        }
    }

    public func deleteEntry(id entryId: String) throws {
        guard let db = db else { return }
        let entry = dictionary.filter(termId == entryId)
        try db.run(entry.delete())
    }

    public func deleteAll() throws {
        guard let db = db else { return }
        try db.run(dictionary.delete())
    }
}
