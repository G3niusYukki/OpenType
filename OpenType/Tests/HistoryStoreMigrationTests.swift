@testable import Data
@testable import Models
import XCTest

final class HistoryStoreMigrationTests: XCTestCase {
    func testStyleProfilesTableExists() throws {
        let store = HistoryStore.shared
        let profiles = try store.getAllStyleProfiles()
        XCTAssertEqual(profiles.count, 0)
    }

    func testStyleExamplesTableExists() throws {
        let store = HistoryStore.shared
        let profileID = UUID()
        let examples = try store.getStyleExamples(for: profileID)
        XCTAssertEqual(examples.count, 0)
    }

    func testAppToneRulesTableExists() throws {
        let store = HistoryStore.shared
        let profileID = UUID()
        let rules = try store.getAppToneRules(for: profileID)
        XCTAssertEqual(rules.count, 0)
    }

    func testToneRulesTableExists() throws {
        let store = HistoryStore.shared
        let profileID = UUID()
        let rules = try store.getToneRules(for: profileID)
        XCTAssertEqual(rules.count, 0)
    }

    func testHistoryEntryHasAppBundleID() {
        let entry = HistoryEntry(
            audioPath: "/tmp/test.wav",
            originalText: "hello",
            processedText: "hello",
            mode: .basic,
            provider: "Apple Speech",
            duration: 1.0,
            language: "en",
            appBundleID: "com.apple.mail"
        )
        XCTAssertEqual(entry.appBundleID, "com.apple.mail")
    }
}
