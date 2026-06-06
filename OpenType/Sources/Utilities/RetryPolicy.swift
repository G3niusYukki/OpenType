import Foundation

public struct RetryPolicy {
    public let maxRetries: Int
    public let baseDelay: TimeInterval
    public let maxDelay: TimeInterval
    public let backoffMultiplier: Double
    public let jitter: Double // 0.0 to 1.0, fraction of random variation

    public init(
        maxRetries: Int = 3,
        baseDelay: TimeInterval = 1.0,
        maxDelay: TimeInterval = 10.0,
        backoffMultiplier: Double = 2.0,
        jitter: Double = 0.25
    ) {
        self.maxRetries = maxRetries
        self.baseDelay = baseDelay
        self.maxDelay = maxDelay
        self.backoffMultiplier = backoffMultiplier
        self.jitter = jitter
    }

    /// Calculate delay for the given attempt number (0-indexed).
    public func delay(for attempt: Int) -> TimeInterval {
        let exponential = baseDelay * pow(backoffMultiplier, Double(attempt))
        let capped = min(exponential, maxDelay)
        let jitterAmount = capped * jitter
        return capped + Double.random(in: -jitterAmount ... jitterAmount)
    }

    /// Whether we should retry at the given attempt number.
    public func shouldRetry(attempt: Int) -> Bool {
        attempt < maxRetries
    }

    /// Whether the given error is transient and worth retrying.
    public func isRetryable(_ error: Error) -> Bool {
        let nsError = error as NSError

        // Network errors that are always retryable
        let retryableCodes: Set<Int> = [
            NSURLErrorTimedOut,
            NSURLErrorNetworkConnectionLost,
            NSURLErrorNotConnectedToInternet,
            NSURLErrorDNSLookupFailed,
            NSURLErrorCannotConnectToHost,
            NSURLErrorInternationalRoamingOff,
        ]

        if nsError.domain == NSURLErrorDomain && retryableCodes.contains(nsError.code) {
            return true
        }

        // AI-specific errors: detected by type name to avoid compile-time dependency on Providers
        let typeName = String(describing: type(of: error))
        if typeName.contains("AIError") {
            let description = error.localizedDescription
            // requestFailed ("AI request failed") and invalidResponse ("Invalid AI response") are retryable
            // apiKeyNotFound ("API key not found") is not
            return description != "API key not found"
        }

        return false
    }
}
