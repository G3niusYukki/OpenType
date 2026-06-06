@testable import Data
@testable import Services
import XCTest

final class DictionaryServiceImportTests: XCTestCase {
    private var temporaryFiles: [URL] = []
    private var createdEntryIds: [String] = []

    override func tearDown() {
        for url in temporaryFiles {
            try? FileManager.default.removeItem(at: url)
        }
        temporaryFiles.removeAll()

        for id in createdEntryIds {
            try? HistoryStore.shared.deleteDictionaryEntry(id: id)
        }
        createdEntryIds.removeAll()

        super.tearDown()
    }

    func testExtractTermsFromPlainText_extractsCapitalizedRepeatedWords() throws {
        let url = try makeTemporaryFile(
            extension: "txt",
            content: "OpenType helps Alice write faster. Alice also uses OpenType every day."
        )

        let terms = try DictionaryService.shared.extractTermsFromDocument(at: url).map(\.term)

        XCTAssertTrue(terms.contains("Alice"))
        XCTAssertTrue(terms.contains("OpenType"))
    }

    func testExtractTermsFromPlainText_skipsStopWords() throws {
        let url = try makeTemporaryFile(
            extension: "txt",
            content: "The The The Alice Alice"
        )

        let terms = try DictionaryService.shared.extractTermsFromDocument(at: url).map(\.term)

        XCTAssertFalse(terms.contains("The"))
        XCTAssertTrue(terms.contains("Alice"))
    }

    func testExtractTermsFromPlainText_skipsExistingEntries() throws {
        let existingTerm = "__test_import_ExistingName"
        try HistoryStore.shared.saveDictionaryEntry(term: existingTerm, replacement: existingTerm, category: "Test")
        createdEntryIds = HistoryStore.shared.getAllDictionaryEntries()
            .filter { $0.term == existingTerm }
            .map(\.id)

        let url = try makeTemporaryFile(
            extension: "txt",
            content: "\(existingTerm) appears twice. \(existingTerm) should not be suggested. FreshName FreshName should be suggested."
        )

        let terms = try DictionaryService.shared.extractTermsFromDocument(at: url).map(\.term)

        XCTAssertFalse(terms.contains(existingTerm))
        XCTAssertTrue(terms.contains("FreshName"))
    }

    func testExtractTermsFromCSV_reusesCSVParsing() throws {
        let url = try makeTemporaryFile(
            extension: "csv",
            content: "CSVTerm,CSV Replacement,Custom\nSoloCSVTerm"
        )

        let entries = try DictionaryService.shared.extractTermsFromDocument(at: url)

        XCTAssertTrue(entries.contains { $0.term == "CSVTerm" && $0.replacement == "CSVTerm" && $0.category == "Imported" })
        XCTAssertTrue(entries.contains { $0.term == "SoloCSVTerm" && $0.replacement == "SoloCSVTerm" && $0.category == "Imported" })
    }

    func testExtractTermsFromMissingFile_throwsError() {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("txt")

        XCTAssertThrowsError(try DictionaryService.shared.extractTermsFromDocument(at: url))
    }

    private func makeTemporaryFile(extension fileExtension: String, content: String) throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(fileExtension)
        try content.write(to: url, atomically: true, encoding: .utf8)
        temporaryFiles.append(url)
        return url
    }
}
