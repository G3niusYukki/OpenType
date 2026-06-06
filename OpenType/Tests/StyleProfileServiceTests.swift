@testable import Models
import Services
import XCTest

final class StyleProfileServiceTests: XCTestCase {
    func testStyleProfileCreation() {
        let profile = StyleProfile(name: "Test Style")
        XCTAssertEqual(profile.name, "Test Style")
        XCTAssertFalse(profile.isActive)
    }

    func testStyleExampleCreation() {
        let profileID = UUID()
        let example = StyleExample(rawText: "um hello", polishedText: "hello", profileID: profileID)
        XCTAssertEqual(example.rawText, "um hello")
        XCTAssertEqual(example.polishedText, "hello")
        XCTAssertEqual(example.profileID, profileID)
        XCTAssertNil(example.appBundleID)
    }

    func testTonePresetInstructions() {
        XCTAssertFalse(TonePreset.professional.instructions.isEmpty)
        XCTAssertEqual(TonePreset.allCases.count, 5)
    }

    func testEditCommandReadOnlyClassification() {
        XCTAssertTrue(EditCommand.summarize.isReadOnly)
        XCTAssertTrue(EditCommand.explain.isReadOnly)
        XCTAssertTrue(EditCommand.translate(to: nil).isReadOnly)
        XCTAssertFalse(EditCommand.rephrase.isReadOnly)
        XCTAssertFalse(EditCommand.shorten.isReadOnly)
        XCTAssertFalse(EditCommand.custom.isReadOnly)
    }

    func testBuildSystemPromptWithNoProfile() {
        let service = StyleProfileService.shared
        let prompt = service.buildSystemPrompt(appBundleID: nil)
        XCTAssertTrue(prompt.contains("filler words"))
    }

    func testBuildTranslationPrompt() {
        let service = StyleProfileService.shared
        let prompt = service.buildTranslationPrompt(from: "en", to: "zh", appBundleID: nil)
        XCTAssertTrue(prompt.contains("Translate"))
        XCTAssertTrue(prompt.contains("en"))
        XCTAssertTrue(prompt.contains("zh"))
    }
}
