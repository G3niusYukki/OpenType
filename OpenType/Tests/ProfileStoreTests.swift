import XCTest
@testable import Models
@testable import Data

final class ProfileStoreTests: XCTestCase {

    func testProfileModel() {
        let profile = Profile(
            name: "Test Profile",
            transcriptionProvider: "Apple Speech",
            aiProvider: "OpenAI",
            isDefault: true
        )
        XCTAssertEqual(profile.name, "Test Profile")
        XCTAssertEqual(profile.transcriptionProvider, "Apple Speech")
        XCTAssertEqual(profile.aiProvider, "OpenAI")
        XCTAssertTrue(profile.isDefault)
    }

    func testProfileEncodable() {
        let profile = Profile(
            name: "Test",
            transcriptionProvider: "Groq",
            aiProvider: "Anthropic",
            isDefault: false
        )
        let data = try? JSONEncoder().encode(profile)
        XCTAssertNotNil(data)
        let decoded = try! JSONDecoder().decode(Profile.self, from: data!)
        XCTAssertEqual(decoded.name, "Test")
        XCTAssertFalse(decoded.isDefault)
    }

    func testVoiceModeConfigWithTargetLanguage() {
        let config = VoiceModeConfig(enabled: true, targetLanguage: "zh")
        XCTAssertEqual(config.targetLanguage, "zh")
        XCTAssertTrue(config.enabled)
    }

    func testVoiceModeConfigDefaultLanguage() {
        let config = VoiceModeConfig()
        XCTAssertNil(config.targetLanguage)
    }
}
