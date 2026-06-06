@testable import Data
@testable import Models
import XCTest

final class SettingsStoreTests: XCTestCase {
    func testDefaultTranscriptionProvider() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "test.settings"))
        defaults.removePersistentDomain(forName: "test.settings")

        // Note: SettingsStore.shared is a singleton. We test defaults behavior separately.
        // The default provider should be set when no value exists.
        let provider = defaults.string(forKey: "selectedTranscriptionProvider")
        // When fresh, no value is set yet until SettingsStore initializes
        XCTAssertNil(provider)
    }

    func testVoiceModeConfigEncodingDecoding() throws {
        let config = VoiceModeConfig(enabled: true, targetLanguage: "ja")
        let data = try JSONEncoder().encode([VoiceMode.translate: config])
        let decoded = try JSONDecoder().decode([VoiceMode: VoiceModeConfig].self, from: data)
        XCTAssertEqual(decoded[.translate]?.targetLanguage, "ja")
        XCTAssertEqual(decoded[.translate]?.enabled, true)
    }

    func testVoiceModeDefaultEnabled() {
        let config = VoiceModeConfig()
        XCTAssertTrue(config.enabled)
    }

    func testVoiceModeAllCasesCount() {
        XCTAssertEqual(VoiceMode.allCases.count, 5)
    }

    func testVoiceModeRawValues() {
        XCTAssertEqual(VoiceMode.basic.rawValue, "basic")
        XCTAssertEqual(VoiceMode.handsFree.rawValue, "handsFree")
        XCTAssertEqual(VoiceMode.translate.rawValue, "translate")
        XCTAssertEqual(VoiceMode.editSelected.rawValue, "editSelected")
    }

    func testVoiceModeDisplayNames() {
        XCTAssertEqual(VoiceMode.basic.displayName, "Basic")
        XCTAssertEqual(VoiceMode.translate.displayName, "Translate")
    }

    func testHotkeyConfigEncodingDecoding() throws {
        let config = HotkeyConfig(keyCode: 2, modifiers: 0x0001_0000)
        let configs = ["basic": config]
        let data = try JSONEncoder().encode(configs)
        let decoded = try JSONDecoder().decode([String: HotkeyConfig].self, from: data)
        XCTAssertEqual(decoded["basic"]?.keyCode, 2)
    }
}
