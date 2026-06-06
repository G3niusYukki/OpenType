import Data
import Foundation
import Models
import Providers
import Utilities

/// Coordinates AI processing for different voice modes.
/// Extracted from PopoverViewModel to separate AI concerns from UI state.
public final class AIProcessingCoordinator {
    private let aiService: AIProcessingService
    private let textInserter: TextInsertionService
    private let styleService: StyleProfileService

    public init(
        aiService: AIProcessingService = .shared,
        textInserter: TextInsertionService = .shared,
        styleService: StyleProfileService = .shared
    ) {
        self.aiService = aiService
        self.textInserter = textInserter
        self.styleService = styleService
    }

    /// Check if AI service is available.
    public var isAvailable: Bool {
        aiService.isAvailable()
    }

    // MARK: - Streaming Accessors

    /// Streaming AI processing — yields accumulated text as it's generated.
    public func processStreaming(text: String, appBundleID: String?) -> AsyncThrowingStream<String, Error> {
        aiService.processStreaming(text: text, appBundleID: appBundleID)
    }

    /// Answer a question with streaming.
    public func answerQuestionStreaming(text: String, appBundleID: String?) -> AsyncThrowingStream<String, Error> {
        aiService.answerQuestionStreaming(text: text, appBundleID: appBundleID)
    }

    /// Translate text.
    public func translate(text: String, from: String, to: String, appBundleID: String?) async throws -> String {
        try await aiService.translate(text: text, from: from, to: to, appBundleID: appBundleID)
    }

    /// Process with a custom prompt.
    public func processWithPrompt(prompt: String, text: String) async throws -> String {
        try await aiService.processWithPrompt(prompt: prompt, text: text)
    }

    // MARK: - Mode Processing

    /// Process text for the given voice mode. Returns result with optional edit command.
    /// Note: `.quickAnswer` returns the input unchanged — the caller handles streaming.
    public func processForMode(_ text: String, mode: VoiceMode, appBundleID: String?) async throws -> ProcessingResult {
        switch mode {
        case .basic, .handsFree:
            return try ProcessingResult(text: await processBasic(text, appBundleID: appBundleID))
        case .translate:
            return try ProcessingResult(text: await processTranslate(text, appBundleID: appBundleID))
        case .editSelected:
            return try await processEditSelected(text, appBundleID: appBundleID)
        case .quickAnswer:
            return ProcessingResult(text: text)
        }
    }

    /// Process edit-selected flow: detect command, build prompt, process, and insert.
    /// Returns the processed text and the detected edit command (nil if no text was selected).
    public func processEditSelected(_ voiceCommand: String, appBundleID: String?) async throws -> ProcessingResult {
        guard let selectedText = textInserter.getSelectedText(), !selectedText.isEmpty else {
            let result = try await processBasic(voiceCommand, appBundleID: appBundleID)
            return ProcessingResult(text: result, editCommand: nil)
        }

        guard aiService.isAvailable() else { return ProcessingResult(text: selectedText) }

        let command = EditCommandDetector.detect(from: voiceCommand)
        let prompt = styleService.buildEditPrompt(selectedText: selectedText, command: command, appBundleID: appBundleID)
        let result = try await aiService.processWithPrompt(prompt: prompt, text: selectedText)

        if command.isReadOnly {
            textInserter.insertTextAfterSelection(result)
        } else {
            textInserter.replaceSelectedText(with: result)
        }

        return ProcessingResult(text: result, editCommand: command)
    }

    /// Process with a preset instruction on selected text.
    public func processPresetEdit(selectedText: String, instruction: String, appBundleID: String?) async throws -> String {
        guard aiService.isAvailable() else { return selectedText }
        let prompt = styleService.buildPresetPrompt(selectedText: selectedText, instruction: instruction, bundleID: appBundleID)
        let result = try await aiService.processWithPrompt(prompt: prompt, text: selectedText)
        textInserter.replaceSelectedText(with: result)
        return result
    }

    // MARK: - Private

    private func processBasic(_ text: String, appBundleID: String?) async throws -> String {
        guard aiService.isAvailable() else { return text }
        return try await aiService.process(text: text, appBundleID: appBundleID)
    }

    private func processTranslate(_ text: String, appBundleID: String?) async throws -> String {
        guard aiService.isAvailable() else { return text }
        let targetLanguage = SettingsStore.shared.voiceModes.configs[.translate]?.targetLanguage ?? "en"
        return try await aiService.translate(text: text, from: "auto", to: targetLanguage, appBundleID: appBundleID)
    }
}

// MARK: - Processing Result

/// Result of AI processing, including optional edit command detection.
public struct ProcessingResult {
    public let text: String
    public let editCommand: EditCommand?

    public init(text: String, editCommand: EditCommand? = nil) {
        self.text = text
        self.editCommand = editCommand
    }
}
