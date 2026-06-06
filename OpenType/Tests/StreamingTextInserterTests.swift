import Providers
@testable import Services
import XCTest

final class StreamingTextInserterTests: XCTestCase {
    func testInsertStreaming_consumesAllChunks() async throws {
        let inserter = StreamingTextInserter(
            textInsertionService: .shared,
            batchSize: 5,
            interBatchDelay: 0
        )

        let stream = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("Hello")
            continuation.yield("Hello, world!")
            continuation.yield("Hello, world! How are you?")
            continuation.finish()
        }

        let result = try await inserter.insertStreaming(stream)
        XCTAssertEqual(result, "Hello, world! How are you?")
    }

    func testInsertStreaming_handlesEmptyStream() async throws {
        let inserter = StreamingTextInserter(textInsertionService: .shared)

        let stream = AsyncThrowingStream<String, Error> { continuation in
            continuation.finish()
        }

        let result = try await inserter.insertStreaming(stream)
        XCTAssertEqual(result, "")
    }

    func testInsertStreaming_handlesError() async {
        let inserter = StreamingTextInserter(textInsertionService: .shared)

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
    }

    func testReset_clearsState() async throws {
        let inserter = StreamingTextInserter(textInsertionService: .shared, interBatchDelay: 0)

        // First insertion
        let stream1 = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("first text")
            continuation.finish()
        }
        _ = try await inserter.insertStreaming(stream1)

        // Reset
        await inserter.reset()

        // Second insertion should start fresh (delta computed from position 0)
        let stream2 = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("second")
            continuation.finish()
        }
        let result = try await inserter.insertStreaming(stream2)
        XCTAssertEqual(result, "second")
    }

    func testInsertStreaming_skipsDuplicateAccumulatedText() async throws {
        // When the stream yields the same accumulated text twice,
        // the delta should be empty and no typing occurs for the duplicate.
        let inserter = StreamingTextInserter(
            textInsertionService: .shared,
            batchSize: 5,
            interBatchDelay: 0
        )

        let stream = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("hello")
            continuation.yield("hello") // duplicate — delta is empty
            continuation.yield("hello world")
            continuation.finish()
        }

        let result = try await inserter.insertStreaming(stream)
        XCTAssertEqual(result, "hello world")
    }

    func testInsertViaTyping_returnsFalseWithoutAccessibility() {
        // In CI, accessibility permission is not granted.
        // insertViaTyping should return false, not crash.
        let service = TextInsertionService.shared
        if !service.hasAccessibilityPermission() {
            let result = service.insertViaTyping("test")
            XCTAssertFalse(result)
        }
    }

    func testInsertViaTyping_returnsTrueForEmptyText() {
        // Empty text is a no-op success, even without accessibility.
        let service = TextInsertionService.shared
        let result = service.insertViaTyping("")
        XCTAssertTrue(result)
    }
}
