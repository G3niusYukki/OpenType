import XCTest
import Foundation
import Models
@testable import Providers
@testable import Data
@testable import Utilities

final class AppleSpeechProviderTimeoutTests: XCTestCase {
    func test_autoDetector_emptyLocales_returnsEmptyImmediately() async throws {
        let detector = AppleSpeechAutoDetector(locales: [], timeout: 12.0)
        let start = Date()
        let (text, _, confidence) = try await detector.detect(audioURL: URL(fileURLWithPath: "/dev/null"))
        let elapsed = Date().timeIntervalSince(start)
        XCTAssertTrue(text.isEmpty)
        XCTAssertEqual(confidence, 0.0)
        XCTAssertLessThan(elapsed, 0.1, "empty locales path must short-circuit")
    }

    func test_autoDetector_exposesTimeoutParameter() {
        // Smoke test: ensure the parameter exists with a sensible default.
        let d1 = AppleSpeechAutoDetector(locales: [Locale(identifier: "en-US")])
        let d2 = AppleSpeechAutoDetector(locales: [Locale(identifier: "en-US")], timeout: 5.0)
        // No assertion on the private field; just that both initializers compile.
        _ = d1
        _ = d2
    }
}
