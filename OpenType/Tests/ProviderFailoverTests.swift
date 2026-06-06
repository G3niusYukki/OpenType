@testable import Models
@testable import Providers
@testable import Services
import XCTest

final class ProviderFailoverTests: XCTestCase {
    func testProviderOrderStartsWithSelected() {
        let failover = ProviderFailover(selectedProvider: "Groq")
        let order = failover.providerOrder()
        XCTAssertEqual(order.first, "Groq")
    }

    func testProviderOrderIncludesAll() {
        let failover = ProviderFailover(selectedProvider: "OpenAI")
        let order = failover.providerOrder()
        XCTAssertEqual(order.count, 7) // All 7 AI providers
    }

    func testProviderOrderRemovesDuplicates() {
        let failover = ProviderFailover(selectedProvider: "OpenAI")
        let order = failover.providerOrder()
        let unique = Set(order)
        XCTAssertEqual(order.count, unique.count)
    }

    func testNextProviderAfterFailure() {
        let failover = ProviderFailover(selectedProvider: "OpenAI")
        let next = failover.nextProvider(after: "OpenAI")
        XCTAssertNotNil(next)
        XCTAssertNotEqual(next, "OpenAI")
    }

    func testNextProviderReturnsNilAtEnd() throws {
        let failover = ProviderFailover(selectedProvider: "OpenAI")
        // After all providers exhausted, nextProvider should return nil
        let allProviders = failover.providerOrder()
        let last = try XCTUnwrap(allProviders.last)
        let next = failover.nextProvider(after: last)
        XCTAssertNil(next)
    }
}
