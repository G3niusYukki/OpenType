@testable import OpenTypeUI
import XCTest

@MainActor
final class PopoverViewModelCancelTests: XCTestCase {
    func testCancelProcessing_whenIdle_isNoOp() {
        let viewModel = PopoverViewModel()

        XCTAssertFalse(viewModel.isProcessing)

        viewModel.cancelProcessing()

        XCTAssertFalse(viewModel.isProcessing)
    }

    func testCancelProcessing_whenProcessing_clearsState() async throws {
        let viewModel = PopoverViewModel()
        let task = Task<Void, Never> {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }

        viewModel.isProcessing = true
        viewModel.originalText = "hello"
        viewModel.aiProcessingTask = task

        viewModel.cancelProcessing()

        try await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertFalse(viewModel.isProcessing)
        XCTAssertTrue(task.isCancelled)
    }

    func testCancelProcessing_rapidDoubleCall_noCrash() {
        let viewModel = PopoverViewModel()

        viewModel.isProcessing = true
        viewModel.originalText = "hello"

        viewModel.cancelProcessing()
        viewModel.cancelProcessing()

        XCTAssertFalse(viewModel.isProcessing)
    }
}
