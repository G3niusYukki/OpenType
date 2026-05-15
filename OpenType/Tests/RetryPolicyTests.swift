import XCTest
@testable import Utilities
@testable import Providers

final class RetryPolicyTests: XCTestCase {

    func testDefaultConfiguration() {
        let policy = RetryPolicy()
        XCTAssertEqual(policy.maxRetries, 3)
        XCTAssertEqual(policy.baseDelay, 1.0)
        XCTAssertEqual(policy.maxDelay, 10.0)
        XCTAssertEqual(policy.backoffMultiplier, 2.0)
    }

    func testDelayCalculation() {
        let policy = RetryPolicy(baseDelay: 1.0, backoffMultiplier: 2.0, jitter: 0)
        XCTAssertEqual(policy.delay(for: 0), 1.0)
        XCTAssertEqual(policy.delay(for: 1), 2.0)
        XCTAssertEqual(policy.delay(for: 2), 4.0)
    }

    func testMaxDelayCap() {
        let policy = RetryPolicy(baseDelay: 1.0, maxDelay: 5.0, backoffMultiplier: 2.0, jitter: 0)
        XCTAssertEqual(policy.delay(for: 10), 5.0) // Capped at maxDelay
    }

    func testShouldRetryRespectsMaxRetries() {
        let policy = RetryPolicy(maxRetries: 2)
        XCTAssertTrue(policy.shouldRetry(attempt: 0))
        XCTAssertTrue(policy.shouldRetry(attempt: 1))
        XCTAssertFalse(policy.shouldRetry(attempt: 2))
        XCTAssertFalse(policy.shouldRetry(attempt: 5))
    }

    func testRetryableErrors() {
        let policy = RetryPolicy()

        let timeout = NSError(domain: NSURLErrorDomain, code: NSURLErrorTimedOut, userInfo: nil)
        XCTAssertTrue(policy.isRetryable(timeout))

        let networkLost = NSError(domain: NSURLErrorDomain, code: NSURLErrorNetworkConnectionLost, userInfo: nil)
        XCTAssertTrue(policy.isRetryable(networkLost))

        let rateLimit = AIError.requestFailed
        XCTAssertTrue(policy.isRetryable(rateLimit))

        let apiKeyMissing = AIError.apiKeyNotFound
        XCTAssertFalse(policy.isRetryable(apiKeyMissing))
    }
}
