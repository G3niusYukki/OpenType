import AppKit
import Combine
import Data
import Foundation
import Models
import Providers
import Services
import SwiftUI
import Utilities

@MainActor
public final class PopoverViewModel: ObservableObject {
    // MARK: - Published State (UI-bound)

    @Published var isRecording = false
    @Published var isProcessing = false
    @Published var transcribedText = ""
    @Published var liveText = ""
    @Published var detectedLang: String?
    @Published var recentHistory: [HistoryEntry] = []
    @Published var currentMode: VoiceMode = .basic
    @Published var isHandsFreeActive = false
    @Published var canSaveStyleExample = false
    @Published var didSaveStyleExample = false
    @Published var detectedEditCommand: EditCommand?
    @Published var quickAnswerText = ""
    @Published var showQuickAnswerActions = false
    @Published var originalText: String = ""
    private var lastRawText: String = ""
    private var lastAppBundleID: String?

    // MARK: - Dependencies

    private let recording = RecordingCoordinator()
    private let transcriptionService = TranscriptionService.shared
    private let aiService = AIProcessingService.shared
    private let textInserter = TextInsertionService.shared
    private let dictionaryService = DictionaryService.shared
    var aiProcessingTask: Task<Void, Never>?

    // MARK: - Init

    init() {
        recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)

        // Mirror recording coordinator state
        recording.$isRecording.assign(to: &$isRecording)
        recording.$liveText.assign(to: &$liveText)
    }

    // MARK: - Recording

    public func startRecording(mode: VoiceMode) {
        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        defaults.set(true, forKey: "isRecordingActive")

        currentMode = mode
        isRecording = true
        transcribedText = ""
        liveText = ""
        detectedLang = nil
        canSaveStyleExample = false
        didSaveStyleExample = false
        detectedEditCommand = nil
        quickAnswerText = ""
        showQuickAnswerActions = false

        NotificationService.shared.playRecordingStartSound()
        lastAppBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier

        recording.onPauseDetected = { [weak self] in
            self?.onPauseDetected()
        }

        Task {
            do {
                try await recording.start(mode: mode)
            } catch {
                print("Failed to start recording: \(error)")
                isRecording = false
                postError("录音启动失败: \(error.localizedDescription)")
            }
        }
    }

    /// Called when VAD detects a pause in speech.
    private func onPauseDetected() {
        guard !recording.didPauseProcess else { return }

        let textToProcess = recording.fullText
        guard !textToProcess.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        recording.didPauseProcess = true

        let dictionaryText = dictionaryService.applyReplacements(to: textToProcess)

        aiProcessingTask?.cancel()
        aiProcessingTask = Task {
            do {
                guard aiService.isAvailable() else {
                    transcribedText = dictionaryText
                    return
                }

                // Use the *current* frontmost for the AI style prompt (per-app
                // tone rules want the app the user is in *right now*), but
                // DO NOT clobber lastAppBundleID — it stays at the value
                // captured at startRecording so the focus-drift guard in
                // stopRecording can detect a window switch.
                let frontmostBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
                let stream = aiService.processStreaming(text: dictionaryText, appBundleID: frontmostBundleID)
                for try await partial in stream {
                    guard !Task.isCancelled else { return }
                    transcribedText = partial
                }
            } catch {
                transcribedText = dictionaryText
            }
        }
    }

    // MARK: - Hands-Free Mode

    func toggleHandsFree() {
        if isHandsFreeActive {
            stopHandsFree()
        } else {
            startHandsFree()
        }
    }

    func startHandsFree() {
        isHandsFreeActive = true
        startRecording(mode: .handsFree)
    }

    func stopHandsFree() {
        isHandsFreeActive = false
        stopRecording()
    }

    // MARK: - Stop Recording

    func stopRecording() {
        NotificationService.shared.playRecordingStopSound()

        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        defaults.set(false, forKey: "isRecordingActive")

        let alreadyPauseProcessed = recording.didPauseProcess
        let processedText = transcribedText

        aiProcessingTask?.cancel()
        isProcessing = true

        let frontmostBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        // Note: lastAppBundleID was already captured in startRecording; we
        // re-read here only to check whether the user switched windows.
        let focusDecision = InsertionFocusGuard.decide(captured: lastAppBundleID, current: frontmostBundleID)

        aiProcessingTask = Task {
            do {
                let (url, duration) = try await recording.stop()
                guard !Task.isCancelled else { return }

                let finalText: String

                if alreadyPauseProcessed, !processedText.isEmpty {
                    finalText = processedText
                    lastRawText = recording.fullText
                    originalText = lastRawText
                    detectedLang = SettingsStore.shared.recentLocales.first
                } else {
                    // Full file-based transcription fallback
                    let autoDetect = SettingsStore.shared.voiceModeConfigs[currentMode]?.autoDetectLanguage ?? true
                    let language: String? = autoDetect ? nil : SettingsStore.shared.voiceModeConfigs[currentMode]?.sourceLanguage

                    let result = try await transcriptionService.transcribe(audioURL: url, language: language)
                    guard !Task.isCancelled else { return }

                    let rawText = recording.fullText.isEmpty ? result.text : recording.fullText
                    lastRawText = result.text
                    originalText = result.text

                    let dictionaryText = dictionaryService.applyReplacements(to: rawText)
                    detectedLang = result.detectedLanguage ?? result.language
                    finalText = try await processForMode(dictionaryText, audioURL: url)
                    guard !Task.isCancelled else { return }
                }

                if currentMode != .editSelected {
                    canSaveStyleExample = true
                    didSaveStyleExample = false
                }

                // Save history
                let entry = HistoryEntry(
                    audioPath: url.path,
                    originalText: lastRawText,
                    processedText: finalText,
                    mode: currentMode,
                    provider: "Apple Speech",
                    duration: duration,
                    language: detectedLang ?? "en",
                    appBundleID: lastAppBundleID
                )
                try? HistoryStore.shared.saveHistoryEntry(entry)

                // Auto-learn dictionary
                dictionaryService.learnFromText(lastRawText)

                // UI updates
                transcribedText = finalText
                liveText = ""
                recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)
                isProcessing = false

                // Auto-insert text — but only if the user hasn't switched apps.
                if focusDecision == .insert,
                   currentMode != .handsFree, currentMode != .quickAnswer
                {
                    if currentMode == .editSelected {
                        if detectedEditCommand == nil {
                            insertText()
                        }
                    } else {
                        insertText()
                    }
                } else if focusDecision == .fallbackToClipboard, !transcribedText.isEmpty {
                    // The user moved to a different app. Don't risk a wrong
                    // paste — copy to clipboard and tell them.
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(transcribedText, forType: .string)
                    postError("You switched apps during processing — text copied to clipboard, paste manually (⌘V).")
                }

                recording.reset()
                audioServiceCleanup(keepingRecent: 20)
            } catch {
                handleError(error)
            }
        }
    }

    private func audioServiceCleanup(keepingRecent count: Int) {
        AudioCaptureService.shared.cleanupTempFiles(keepingRecent: count)
    }

    // MARK: - Mode Processing

    private func processForMode(_ text: String, audioURL _: URL) async throws -> String {
        switch currentMode {
        case .basic, .handsFree:
            return try await processBasic(text)
        case .translate:
            return try await processTranslate(text)
        case .editSelected:
            return try await processEditSelected(text)
        case .quickAnswer:
            return try await processQuickAnswer(text)
        }
    }

    private func processBasic(_ text: String) async throws -> String {
        guard aiService.isAvailable() else { return text }

        var lastResult = text
        let stream = aiService.processStreaming(text: text, appBundleID: lastAppBundleID)
        do {
            for try await partial in stream {
                guard !Task.isCancelled else { return lastResult }
                lastResult = partial
                transcribedText = partial
            }
        } catch {
            throw error
        }
        return lastResult
    }

    private func processTranslate(_ text: String) async throws -> String {
        guard aiService.isAvailable() else { return text }
        let targetLanguage = SettingsStore.shared.voiceModeConfigs[.translate]?.targetLanguage ?? "en"
        let result = try await aiService.translate(text: text, from: "auto", to: targetLanguage, appBundleID: lastAppBundleID)
        guard !Task.isCancelled else { return text }
        return result
    }

    private func processEditSelected(_ voiceCommand: String) async throws -> String {
        guard let selectedText = textInserter.getSelectedText(), !selectedText.isEmpty else {
            detectedEditCommand = nil
            return try await processBasic(voiceCommand)
        }

        guard aiService.isAvailable() else { return selectedText }

        let command = EditCommandDetector.detect(from: voiceCommand)
        let prompt = StyleProfileService.shared.buildEditPrompt(selectedText: selectedText, command: command, appBundleID: lastAppBundleID)
        let result = try await aiService.processWithPrompt(prompt: prompt, text: selectedText)
        guard !Task.isCancelled else { return selectedText }
        detectedEditCommand = command

        if command.isReadOnly {
            textInserter.insertTextAfterSelection(result)
        } else {
            textInserter.replaceSelectedText(with: result)
        }

        return result
    }

    private func processPresetEdit(selectedText: String, instruction: String) async throws -> String {
        guard aiService.isAvailable() else { return selectedText }

        let prompt = StyleProfileService.shared.buildPresetPrompt(
            selectedText: selectedText,
            instruction: instruction,
            bundleID: lastAppBundleID
        )
        let result = try await aiService.processWithPrompt(prompt: prompt, text: selectedText)
        guard !Task.isCancelled else { return selectedText }
        textInserter.replaceSelectedText(with: result)
        return result
    }

    private func processQuickAnswer(_ text: String) async throws -> String {
        guard aiService.isAvailable() else {
            postError("Quick Answer requires an AI provider to be configured")
            return text
        }

        var lastResult = text
        let stream = aiService.answerQuestionStreaming(text: text, appBundleID: lastAppBundleID)
        do {
            for try await partial in stream {
                guard !Task.isCancelled else { return lastResult }
                lastResult = partial
                quickAnswerText = partial
            }
        } catch {
            throw error
        }

        showQuickAnswerActions = true
        return lastResult
    }

    // MARK: - Error Handling

    private func handleError(_ error: Error) {
        let message: String
        if let audioError = error as? AudioCaptureError {
            switch audioError {
            case .notPermitted: message = "麦克风权限被拒绝，请在系统设置中授权"
            case .noInputDevice: message = "未检测到麦克风设备"
            case .recordingInProgress: message = "录音已在进行中"
            case .notRecording: message = "未在录音"
            case .engineStartFailed: message = "录音引擎启动失败"
            case .fileWriteFailed: message = "音频文件写入失败"
            }
        } else if let aiError = error as? AIError {
            switch aiError {
            case .apiKeyNotFound: message = "API Key 未配置，请在设置中添加"
            case .requestFailed: message = "AI 请求失败，请检查网络"
            case .invalidResponse: message = "AI 返回无效响应"
            }
        } else {
            message = error.localizedDescription
        }

        transcribedText = ""
        isProcessing = false
        postError(message)
    }

    private func postError(_ message: String) {
        NotificationCenter.default.post(
            name: .transcriptionError,
            object: nil,
            userInfo: ["message": message]
        )
    }

    // MARK: - Actions

    public func cancelProcessing() {
        guard isProcessing else { return }
        let task = aiProcessingTask
        aiProcessingTask = nil
        task?.cancel()
        isProcessing = false

        if !originalText.isEmpty {
            Task { @MainActor in
                do {
                    try textInserter.insertText(originalText)
                } catch {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(originalText, forType: .string)
                }
            }
        }
    }

    public func applyPromptPreset(_ preset: PromptPreset) {
        guard let selectedText = textInserter.getSelectedText(), !selectedText.isEmpty else {
            postError("No text selected")
            return
        }

        lastAppBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        originalText = selectedText
        transcribedText = ""
        detectedEditCommand = nil
        isProcessing = true

        aiProcessingTask?.cancel()
        aiProcessingTask = Task {
            do {
                let result = try await processPresetEdit(selectedText: selectedText, instruction: preset.instruction)
                guard !Task.isCancelled else { return }
                transcribedText = result
                isProcessing = false
            } catch {
                handleError(error)
            }
        }
    }

    func saveAsStyleExample() {
        guard let profile = StyleProfileService.shared.getActiveProfile(forBundleID: lastAppBundleID) else { return }
        let example = StyleExample(
            rawText: lastRawText,
            polishedText: transcribedText,
            appBundleID: lastAppBundleID,
            profileID: profile.id
        )
        try? StyleProfileService.shared.saveStyleExample(example)
        didSaveStyleExample = true
        canSaveStyleExample = false
    }

    func insertText() {
        do {
            try textInserter.insertText(transcribedText)
        } catch let error as TextInsertionError {
            switch error {
            case .noAccessibilityPermission:
                postError("需要辅助功能权限才能插入文本，请在系统设置中授权")
            case .allMethodsFailed:
                postError("文本已复制到剪贴板，请手动粘贴 (Cmd+V)")
            default:
                postError("文本插入失败: \(error.localizedDescription)")
            }
        } catch {
            postError("文本插入失败: \(error.localizedDescription)")
        }
    }

    func openHistory() {
        NotificationCenter.default.post(name: .openHistoryWindow, object: nil)
    }

    func openSettings() {
        NotificationCenter.default.post(name: .openSettingsWindow, object: nil)
    }

    func copyToClipboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    func insertQuickAnswer() {
        do {
            try textInserter.insertText(quickAnswerText)
        } catch let error as TextInsertionError {
            switch error {
            case .noAccessibilityPermission:
                postError("需要辅助功能权限才能插入文本，请在系统设置中授权")
            case .allMethodsFailed:
                postError("文本已复制到剪贴板，请手动粘贴 (Cmd+V)")
            default:
                postError("文本插入失败: \(error.localizedDescription)")
            }
        } catch {
            postError("文本插入失败: \(error.localizedDescription)")
        }
        showQuickAnswerActions = false
    }

    func copyQuickAnswer() {
        copyToClipboard(quickAnswerText)
        showQuickAnswerActions = false
    }
}

// MARK: - Notification Names

public extension Notification.Name {
    static let openHistoryWindow = Notification.Name("openHistoryWindow")
    static let openSettingsWindow = Notification.Name("openSettingsWindow")
    static let openDiagnosticsWindow = Notification.Name("openDiagnosticsWindow")
    static let transcriptionError = Notification.Name("transcriptionError")
    static let hotkeyConfigChanged = Notification.Name("hotkeyConfigChanged")
    static let hotkeyBasic = Notification.Name("hotkeyBasic")
    static let hotkeyHandsFree = Notification.Name("hotkeyHandsFree")
    static let hotkeyTranslate = Notification.Name("hotkeyTranslate")
    static let hotkeyEditSelected = Notification.Name("hotkeyEditSelected")
    static let hotkeyQuickAnswer = Notification.Name("hotkeyQuickAnswer")
}
