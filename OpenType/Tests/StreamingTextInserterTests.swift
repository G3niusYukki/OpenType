import Providers
@testable import Services
import XCTest

final class StreamingTextInserterTests: XCTestCase {

    /// Mutable box to capture typed deltas from the closure.
    private final class DeltaCapture: @unchecked Sendable {
        var deltas: [String] = []
    }

    /// Create an inserter with a no-op typing function that captures deltas.
    private func makeInserter(capture: DeltaCapture) -> StreamingTextInserter {
        StreamingTextInserter(
            textInsertionService: .shared,
            batchSize: 5,
            interBatchDelay: 0,
            typeText: { text, _, _ in
                capture.deltas.append(text)
                return true
            }
        )
    }

    func testInsertStreaming_consumesAllChunks() async throws {
        let capture = DeltaCapture()
        let inserter = makeInserter(capture: capture)

        let stream = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("Hello")
            continuation.yield("Hello, world!")
            continuation.yield("Hello, world! How are you?")
            continuation.finish()
        }

        let result = try await inserter.insertStreaming(stream)
        XCTAssertEqual(result, "Hello, world! How are you?")
        XCTAssertEqual(capture.deltas, ["Hello", ", world!", " How are you?"])
    }

    func testInsertStreaming_handlesEmptyStream() async throws {
        let capture = DeltaCapture()
        let inserter = makeInserter(capture: capture)

        let stream = AsyncThrowingStream<String, Error> { continuation in
            continuation.finish()
        }

        let result = try await inserter.insertStreaming(stream)
        XCTAssertEqual(result, "")
        XCTAssertTrue(capture.deltas.isEmpty)
    }

    func testInsertStreaming_handlesError() async {
        let capture = DeltaCapture()
        let inserter = makeInserter(capture: capture)

        let stream = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("partial")
            continuation.finish(throwing: AIError.requestFailed)
        }

        do {
            _ = try await inserter.insertStreaming(stream)
            XCTFail("Should have thrown")
        } catch {
            XCTAssertTrue(error is AIError)
        }
        XCTAssertEqual(capture.deltas, ["partial"])
    }

    func testReset_clearsState() async throws {
        let capture = DeltaCapture()
        let inserter = makeInserter(capture: capture)

        let stream1 = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("first")
            continuation.finish()
        }
        _ = try await inserter.insertStreaming(stream1)

        await inserter.reset()

        let stream2 = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("second")
            continuation.finish()
        }
        let result = try await inserter.insertStreaming(stream2)
        XCTAssertEqual(result, "second")
        XCTAssertEqual(capture.deltas, ["first", "second"])
    }

    func testInsertStreaming_skipsDuplicateAccumulatedText() async throws {
        let capture = DeltaCapture()
        let inserter = makeInserter(capture: capture)

        let stream = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("same text")
            continuation.yield("same text")
            continuation.yield("same text plus more")
            continuation.finish()
        }

        let result = try await inserter.insertStreaming(stream)
        XCTAssertEqual(result, "same text plus more")
        XCTAssertEqual(capture.deltas, ["same text", " plus more"])
    }
}
