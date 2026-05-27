import XCTest
@testable import Data

final class AppProfileBindingStoreTests: XCTestCase {
    private var defaults: UserDefaults!
    private var store: AppProfileBindingStore!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "AppProfileBindingTests")!
        defaults.removePersistentDomain(forName: "AppProfileBindingTests")
        store = AppProfileBindingStore(defaults: defaults)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "AppProfileBindingTests")
        store = nil
        defaults = nil
        super.tearDown()
    }

    func testEmptyByDefault() {
        XCTAssertEqual(store.getAllBindings(), [])
    }

    func testAddBinding() {
        let profileID = UUID()

        let binding = store.addBinding(bundleID: "com.apple.Mail", appName: "Mail", profileID: profileID)

        let bindings = store.getAllBindings()
        XCTAssertEqual(bindings.count, 1)
        XCTAssertEqual(bindings.first, binding)
        XCTAssertEqual(bindings.first?.bundleID, "com.apple.Mail")
        XCTAssertEqual(bindings.first?.appName, "Mail")
        XCTAssertEqual(bindings.first?.profileID, profileID)
    }

    func testUpdateBindingByBundleIDReplaces() {
        let firstProfileID = UUID()
        let secondProfileID = UUID()
        _ = store.addBinding(bundleID: "com.apple.Mail", appName: "Mail", profileID: firstProfileID)

        let replacement = store.addBinding(bundleID: "com.apple.Mail", appName: "Mail", profileID: secondProfileID)

        let bindings = store.getAllBindings()
        XCTAssertEqual(bindings.count, 1)
        XCTAssertEqual(bindings.first, replacement)
        XCTAssertEqual(bindings.first?.profileID, secondProfileID)
    }

    func testDeleteBinding() {
        let binding = store.addBinding(bundleID: "com.apple.Mail", appName: "Mail", profileID: UUID())

        store.deleteBinding(id: binding.id)

        XCTAssertEqual(store.getAllBindings().count, 0)
    }

    func testFindByBundleID() {
        let profileID = UUID()
        let binding = store.addBinding(bundleID: "com.apple.Mail", appName: "Mail", profileID: profileID)

        XCTAssertEqual(store.binding(for: "com.apple.Mail"), binding)
        XCTAssertNil(store.binding(for: "com.tinyspeck.slackmacgap"))
    }
}
