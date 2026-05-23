import SwiftUI
import AppKit
import Combine
import Models
import Providers
import Services
import Data
import Utilities

@MainActor
class PopoverViewModel: ObservableObject {
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
    private var lastRawText: String = ""
    private var lastAppBundleID: String?

    private let audioService = AudioCaptureService.shared
    private let transcriptionService = TranscriptionService.shared
    private let aiService = AIProcessingService.shared
    private let textInserter = TextInsertionService.shared
    private let dictionaryService = DictionaryService.shared
    private let realtimeTranscription = RealtimeTranscriptionService.shared
    private let vadDetector = VADDetector.shared
    private var streamingTask: Task<Void, Never>?
    private var aiProcessingTask: Task<Void, Never>?
    private var accumulatedLiveText = ""
    private var didPauseProcess = false
    private var levelCancellable: AnyCancellable?

    init() {
        recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)
    }

    func startRecording(mode: VoiceMode) {
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
        accumulatedLiveText = ""
        didPauseProcess = false

        NotificationService.shared.playRecordingStartSound()

        Task {
            do {
                try await audioService.startRecording()

                // Wire audio buffer to realtime transcription
                audioService.onBufferReceived = { [weak self] buffer in
                    self?.realtimeTranscription.appendBuffer(buffer)
                }

                // Start realtime transcription (Apple Speech)
                try realtimeTranscription.start()

                // Wire callbacks
                realtimeTranscription.onPartialResult = { [weak self] text in
                    Task { @MainActor in
                        self?.liveText = text
                    }
                }

                realtimeTranscription.onSegmentFinalized = { [weak self] segment in
                    Task { @MainActor in
                        guard let self = self else { return }
                        self.accumulatedLiveText += (self.accumulatedLiveText.isEmpty ? "" : " ") + segment
                    }
                }

                // Start VAD detector for pause-based AI processing
                vadDetector.onPauseDetected = { [weak self] in
                    Task { @MainActor in
                        self?.onPauseDetected()
                    }
                }
                vadDetector.start()

                // Feed audio levels to VAD (via Combine observation)
                levelCancellable = audioService.$audioLevel
                    .sink { [weak self] level in
                        self?.vadDetector.updateAudioLevel(level)
                    }

            } catch {
                print("Failed to start recording: \(error)")
                isRecording = false
                postError("录音启动失败: \(error.localizedDescription)")
            }
        }
    }

    /// Called when VAD detects a pause in speech.
    /// Triggers AI post-processing on the accumulated text so far.
    private func onPauseDetected() {
        // Only process once per recording session (avoid repeated processing)
        guard !didPauseProcess else { return }

        let textToProcess = realtimeTranscription.fullText.isEmpty
            ? accumulatedLiveText
            : realtimeTranscription.fullText

        guard !textToProcess.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        didPauseProcess = true

        // Apply dictionary replacements
        let dictionaryText = dictionaryService.applyReplacements(to: textToProcess)

        // Trigger AI processing in background
        aiProcessingTask?.cancel()
        aiProcessingTask = Task {
            do {
                guard aiService.isAvailable() else {
                    // No AI provider — show raw text
                    transcribedText = dictionaryText
                    return
                }

                let frontmostBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
                lastAppBundleID = frontmostBundleID

                // Stream AI result
                let stream = aiService.processStreaming(text: dictionaryText, appBundleID: frontmostBundleID)
                for try await partial in stream {
                    guard !Task.isCancelled else { return }
                    transcribedText = partial
                }

                // AI processing done — the text is already displayed
                // When recording stops, we'll use this result
            } catch {
                // AI processing failed — keep the raw text
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

    // MARK: - Stop Recording (Mode Routing)

    func stopRecording() {
        isRecording = false

        NotificationService.shared.playRecordingStopSound()

        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        defaults.set(false, forKey: "isRecordingActive")

        // Stop realtime transcription and VAD
        realtimeTranscription.stop()
        vadDetector.stop()
        levelCancellable?.cancel()
        levelCancellable = nil
        audioService.onBufferReceived = nil
        streamingTask?.cancel()
        streamingTask = nil

        isProcessing = true

        let frontmostBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        lastAppBundleID = frontmostBundleID

        // If VAD already triggered AI processing, wait for it to finish and use that result
        let alreadyProcessed = didPauseProcess
        let processedText = transcribedText

        Task {
            do {
                let (url, duration) = try await audioService.stopRecording()

                let finalText: String

                if alreadyProcessed && !processedText.isEmpty {
                    // VAD-triggered AI processing already happened — wait for it to complete
                    aiProcessingTask?.cancel() // cancel is safe if already done
                    finalText = processedText
                    lastRawText = realtimeTranscription.fullText.isEmpty ? accumulatedLiveText : realtimeTranscription.fullText

                    // Get language from realtime transcription
                    detectedLang = SettingsStore.shared.recentLocales.first
                } else {
                    // No VAD processing happened — do full file-based transcription
                    aiProcessingTask?.cancel()
                    aiProcessingTask = nil

                    // Determine language: nil for auto-detect, or configured source language
                    let autoDetect = SettingsStore.shared.voiceModeConfigs[currentMode]?.autoDetectLanguage ?? true
                    let language: String? = autoDetect ? nil : SettingsStore.shared.voiceModeConfigs[currentMode]?.sourceLanguage

                    let result = try await transcriptionService.transcribe(audioURL: url, language: language)
                    lastRawText = result.text

                    // Use realtime text if available, otherwise file transcription
                    let realtimeFullText = realtimeTranscription.fullText.isEmpty ? accumulatedLiveText : realtimeTranscription.fullText
                    let rawText = realtimeFullText.isEmpty ? result.text : realtimeFullText

                    // 词典替换
                    let dictionaryText = dictionaryService.applyReplacements(to: rawText)

                    // 语言检测
                    detectedLang = result.detectedLanguage ?? result.language

                    // 按模式分流处理
                    finalText = try await processForMode(dictionaryText, audioURL: url)
                }

                if currentMode != .editSelected {
                    canSaveStyleExample = true
                    didSaveStyleExample = false
                }

                // 保存历史
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

                // 自动学习词典
                dictionaryService.learnFromText(lastRawText)

                // UI 更新
                transcribedText = finalText
                liveText = ""
                recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)
                isProcessing = false

                // 自动插入文本
                if currentMode != .handsFree && currentMode != .quickAnswer {
                    if currentMode == .editSelected {
                        if detectedEditCommand == nil {
                            insertText()
                        }
                        // Otherwise, insertion already handled in processEditSelected
                    } else {
                        insertText()
                    }
                }

                audioService.cleanupTempFiles(keepingRecent: 20)
            } catch {
                handleError(error)
            }
        }
    }

    // MARK: - Mode Processing

    private func processForMode(_ text: String, audioURL: URL) async throws -> String {
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

        // Use streaming for real-time UI feedback — iterate AsyncThrowingStream directly
        // (no continuation wrapper needed since we're already in an async context)
        var lastResult = text
        let stream = aiService.processStreaming(text: text, appBundleID: lastAppBundleID)
        do {
            for try await partial in stream {
                lastResult = partial
                transcribedText = partial // @MainActor — safe since PopoverViewModel is @MainActor
            }
        } catch {
            // If streaming fails completely, rethrow — caller handles error
            throw error
        }
        return lastResult
    }

    private func processTranslate(_ text: String) async throws -> String {
        guard aiService.isAvailable() else { return text }
        let targetLanguage = SettingsStore.shared.voiceModeConfigs[.translate]?.targetLanguage ?? "en"
        return try await aiService.translate(text: text, from: "auto", to: targetLanguage, appBundleID: lastAppBundleID)
    }

    private func processEditSelected(_ voiceCommand: String) async throws -> String {
        // 获取选中的文本
        guard let selectedText = textInserter.getSelectedText(), !selectedText.isEmpty else {
            detectedEditCommand = nil
            // 没有选中文本时当作普通语音输入
            return try await processBasic(voiceCommand)
        }

        guard aiService.isAvailable() else { return selectedText }

        let command = EditCommandDetector.detect(from: voiceCommand)
        let prompt = StyleProfileService.shared.buildEditPrompt(selectedText: selectedText, command: command, appBundleID: lastAppBundleID)
        let result = try await aiService.processWithPrompt(prompt: prompt, text: selectedText)
        detectedEditCommand = command

        if command.isReadOnly {
            textInserter.insertTextAfterSelection(result)
        } else {
            textInserter.replaceSelectedText(with: result)
        }

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

    func saveAsStyleExample() {
        guard let profile = try? StyleProfileService.shared.getAllStyleProfiles().first(where: { $0.isActive }) else { return }
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
                // Silent fallback: text is already on clipboard from the last-resort path
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

extension Notification.Name {
    public static let openHistoryWindow = Notification.Name("openHistoryWindow")
    public static let openSettingsWindow = Notification.Name("openSettingsWindow")
    public static let openDiagnosticsWindow = Notification.Name("openDiagnosticsWindow")
    public static let transcriptionError = Notification.Name("transcriptionError")
    public static let hotkeyConfigChanged = Notification.Name("hotkeyConfigChanged")
    public static let hotkeyBasic = Notification.Name("hotkeyBasic")
    public static let hotkeyHandsFree = Notification.Name("hotkeyHandsFree")
    public static let hotkeyTranslate = Notification.Name("hotkeyTranslate")
    public static let hotkeyEditSelected = Notification.Name("hotkeyEditSelected")
    public static let hotkeyQuickAnswer = Notification.Name("hotkeyQuickAnswer")
}
