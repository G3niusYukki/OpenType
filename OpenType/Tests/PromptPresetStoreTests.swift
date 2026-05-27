import XCTest
@testable import Models
@testable import Data

final class PromptPresetStoreTests: XCTestCase {
    private let suiteName = "PromptPresetStoreTestsSuite"
    private var defaults: UserDefaults!
    private var store: PromptPresetStore!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        store = PromptPresetStore(defaults: defaults)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        store = nil
        defaults = nil
        super.tearDown()
    }

    func testBuiltInsReturnedFirst() {
        let presets = store.getAllPresets()

        XCTAssertEqual(presets.count, 10)
        XCTAssertEqual(presets.prefix(10).map(\.isBuiltIn), Array(repeating: true, count: 10))
        XCTAssertEqual(presets.map(\.sortOrder), Array(0..<10))
        XCTAssertEqual(presets.first?.id, UUID(uuidString: "00000000-0000-0000-0000-000000000001")!)
        XCTAssertEqual(presets.last?.id, UUID(uuidString: "00000000-0000-0000-0000-00000000000A")!)
    }

    func testAddCustomPresetPersists() {
        let created = store.addCustomPreset(
            name: "Friendly Reply",
            icon: "hand.wave",
            instruction: "Make this sound friendly."
        )
        let reloaded = PromptPresetStore(defaults: defaults)

        let customs = reloaded.getCustomPresets()
        XCTAssertEqual(customs.count, 1)
        XCTAssertEqual(customs.first?.id, created.id)
        XCTAssertEqual(customs.first?.name, "Friendly Reply")
        XCTAssertEqual(customs.first?.icon, "hand.wave")
        XCTAssertEqual(customs.first?.instruction, "Make this sound friendly.")
        XCTAssertFalse(customs.first?.isBuiltIn ?? true)
    }

    func testCannotDeleteBuiltIn() {
        let builtIn = PromptPreset.builtIns[0]

        XCTAssertThrowsError(try store.deleteCustomPreset(id: builtIn.id))
    }

    func testCustomPresetCRUD() throws {
        var preset = store.addCustomPreset(
            name: "Draft",
            icon: "pencil",
            instruction: "Rewrite as a draft."
        )
        XCTAssertEqual(store.getCustomPresets().count, 1)

        preset.name = "Final Draft"
        preset.icon = "doc.text"
        preset.instruction = "Rewrite as a final draft."
        try store.updateCustomPreset(preset)

        let updated = try XCTUnwrap(store.getCustomPresets().first)
        XCTAssertEqual(updated.name, "Final Draft")
        XCTAssertEqual(updated.icon, "doc.text")
        XCTAssertEqual(updated.instruction, "Rewrite as a final draft.")

        try store.deleteCustomPreset(id: preset.id)
        XCTAssertTrue(store.getCustomPresets().isEmpty)
    }

    func testCustomPresetsDecodeFromJSON() throws {
        let preset = PromptPreset(
            id: UUID(uuidString: "11111111-1111-1111-1111-111111111111")!,
            name: "Manual JSON",
            icon: "sparkles",
            instruction: "Rewrite from manual JSON.",
            isBuiltIn: false,
            sortOrder: 10
        )
        let data = try JSONEncoder().encode([preset])
        defaults.set(data, forKey: "prompt_presets_custom_v1")

        let customs = store.getCustomPresets()
        XCTAssertEqual(customs, [preset])
    }
}
