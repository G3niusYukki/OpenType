import Foundation

/// URLProtocol subclass that intercepts HTTP requests and returns mock responses.
/// Register via URLSessionConfiguration with `protocolClasses: [MockURLProtocol.self]`.
final class MockURLProtocol: URLProtocol {
    /// Thread-safe handler storage keyed by request URL substring.
    nonisolated(unsafe) static var mockHandlers: [String: (URLRequest) -> (Data, HTTPURLResponse)] = [:]

    /// Set a handler for a URL substring pattern.
    static func setHandler(for urlSubstring: String, handler: @escaping (URLRequest) -> (Data, HTTPURLResponse)) {
        mockHandlers[urlSubstring] = handler
    }

    /// Clear all handlers. Call in tearDown().
    static func clearHandlers() {
        mockHandlers = [:]
    }

    override class func canInit(with _: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override class func requestIsCacheEquivalent(_: URLRequest, to _: URLRequest) -> Bool {
        false
    }

    override func startLoading() {
        guard let url = request.url?.absoluteString,
              let handler = MockURLProtocol.mockHandlers.first(where: { url.contains($0.key) })?.value
        else {
            let response = HTTPURLResponse(url: request.url!, statusCode: 404, httpVersion: nil, headerFields: nil)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data())
            client?.urlProtocolDidFinishLoading(self)
            return
        }

        let (data, response) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

extension URLSessionConfiguration {
    /// Create a configuration that uses MockURLProtocol for testing.
    static var mock: URLSessionConfiguration {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return config
    }
}
