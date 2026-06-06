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
    private let dictionaryService = DictionaryService.shared
    private let aiCoordinator = AIProcessingCoordinator()
    private let insertionCoordinator = TextInsertionCoordinator()
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
                guard aiCoordinator.isAvailable else {
                    transcribedText = dictionaryText
                    return
                }

                let frontmostBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
                let stream = aiCoordinator.processStreaming(text: dictionaryText, appBundleID: frontmostBundleID)
                await insertionCoordinator.resetStreaming()
                let result = try await insertionCoordinator.streamingInserter.insertStreaming(stream, capturedBundleID: lastAppBundleID)
                guard !Task.isCancelled else { return }
                transcribedText = result
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
                    detectedLang = SettingsStore.shared.style.recentLocales.first
                } else {
                    let autoDetect = SettingsStore.shared.voiceModes.configs[currentMode]?.autoDetectLanguage ?? true
                    let language: String? = autoDetect ? nil : SettingsStore.shared.voiceModes.configs[currentMode]?.sourceLanguage

                    let result = try await transcriptionService.transcribe(audioURL: url, language: language)
                    guard !Task.isCancelled else { return }

                    let rawText = recording.fullText.isEmpty ? result.text : recording.fullText
                    lastRawText = result.text
                    originalText = result.text

                    let dictionaryText = dictionaryService.applyReplacements(to: rawText)
                    detectedLang = result.detectedLanguage ?? result.language

                    if currentMode == .quickAnswer {
                        if aiCoordinator.isAvailable {
                            var lastResult = dictionaryText
                            let stream = aiCoordinator.answerQuestionStreaming(text: dictionaryText, appBundleID: lastAppBundleID)
                            for try await partial in stream {
                                guard !Task.isCancelled else { return }
                                lastResult = partial
                                quickAnswerText = partial
                            }
                            showQuickAnswerActions = true
                            finalText = lastResult
                        } else {
                            postError("Quick Answer requires an AI provider to be configured")
                            finalText = dictionaryText
                        }
                    } else if currentMode == .basic || currentMode == .handsFree {
                        if aiCoordinator.isAvailable {
                            let stream = aiCoordinator.processStreaming(text: dictionaryText, appBundleID: lastAppBundleID)
                            await insertionCoordinator.resetStreaming()
                            let streamed = try await insertionCoordinator.streamingInserter.insertStreaming(stream, capturedBundleID: lastAppBundleID)
                            guard !Task.isCancelled else { return }
                            transcribedText = streamed
                            finalText = streamed
                        } else {
                            finalText = dictionaryText
                        }
                    } else {
                        let processingResult = try await aiCoordinator.processForMode(dictionaryText, mode: currentMode, appBundleID: lastAppBundleID)
                        guard !Task.isCancelled else { return }
                        finalText = processingResult.text
                        detectedEditCommand = processingResult.editCommand
                    }
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
                            if let error = insertionCoordinator.insertText(transcribedText) {
                                postError(error)
                            }
                        }
                    } else {
                        if let error = insertionCoordinator.insertText(transcribedText) {
                            postError(error)
                        }
                    }
                } else if focusDecision == .fallbackToClipboard, !transcribedText.isEmpty {
                    insertionCoordinator.copyToClipboard(transcribedText)
                    postError("You switched apps during processing — text copied to clipboard, paste manually (⌘V).")
                }

                recording.reset()
                AudioCaptureService.shared.cleanupTempFiles(keepingRecent: 20)
            } catch {
                handleError(error)
            }
        }
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
                if insertionCoordinator.insertText(originalText) != nil {
                    insertionCoordinator.copyToClipboard(originalText)
                }
            }
        }
    }

    public func applyPromptPreset(_ preset: PromptPreset) {
        guard let selectedText = insertionCoordinator.getSelectedText(), !selectedText.isEmpty else {
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
                let result = try await aiCoordinator.processPresetEdit(selectedText: selectedText, instruction: preset.instruction, appBundleID: lastAppBundleID)
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

    func openHistory() {
        NotificationCenter.default.post(name: .openHistoryWindow, object: nil)
    }

    func openSettings() {
        NotificationCenter.default.post(name: .openSettingsWindow, object: nil)
    }

    func copyToClipboard(_ text: String) {
        insertionCoordinator.copyToClipboard(text)
    }

    func insertQuickAnswer() {
        if let error = insertionCoordinator.insertText(quickAnswerText) {
            postError(error)
        }
        showQuickAnswerActions = false
    }

    func copyQuickAnswer() {
        insertionCoordinator.copyToClipboard(quickAnswerText)
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
