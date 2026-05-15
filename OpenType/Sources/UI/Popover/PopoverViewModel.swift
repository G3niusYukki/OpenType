import SwiftUI
import AppKit
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
    private var lastRawText: String = ""
    private var lastAppBundleID: String?

    private let audioService = AudioCaptureService.shared
    private let transcriptionService = TranscriptionService.shared
    private let aiService = AIProcessingService.shared
    private let textInserter = TextInsertionService.shared
    private let dictionaryService = DictionaryService.shared
    private var streamingTask: Task<Void, Never>?

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

        Task {
            do {
                try await audioService.startRecording()
                // 启动流式转写
                startStreamingTranscription()
            } catch {
                print("Failed to start recording: \(error)")
                isRecording = false
                postError("录音启动失败: \(error.localizedDescription)")
            }
        }
    }

    private func startStreamingTranscription() {
        streamingTask?.cancel()
        streamingTask = Task {
            // 等待音频文件有数据
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard !Task.isCancelled, isRecording else { return }

            do {
                // 获取当前录音文件 URL
                let tempFile = FileManager.default.temporaryDirectory
                    .appendingPathComponent("opentype_stream_temp.wav")

                let stream = transcriptionService.transcribeStreaming(audioURL: tempFile)
                for try await text in stream {
                    guard !Task.isCancelled, isRecording else { break }
                    liveText = text
                }
            } catch {
                // 流式转写失败，不打断录音
                print("Streaming transcription error: \(error)")
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

        let defaults = UserDefaults(suiteName: Constants.UserDefaults.suiteName) ?? .standard
        defaults.set(false, forKey: "isRecordingActive")

        isProcessing = true
        streamingTask?.cancel()
        streamingTask = nil

        let frontmostBundleID = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
        lastAppBundleID = frontmostBundleID

        Task {
            do {
                let (url, duration) = try await audioService.stopRecording()

                // Determine language: nil for auto-detect, or configured source language
                let autoDetect = SettingsStore.shared.voiceModeConfigs[currentMode]?.autoDetectLanguage ?? true
                let language: String? = autoDetect ? nil : SettingsStore.shared.voiceModeConfigs[currentMode]?.sourceLanguage

                let result = try await transcriptionService.transcribe(audioURL: url, language: language)
                lastRawText = result.text

                // 优先使用流式实时结果，如果为空则用文件转写结果
                let rawText = liveText.isEmpty ? result.text : liveText

                // 词典替换
                let dictionaryText = dictionaryService.applyReplacements(to: rawText)

                // 语言检测
                detectedLang = result.detectedLanguage ?? result.language

                // 按模式分流处理
                let finalText = try await processForMode(dictionaryText, audioURL: url)

                if currentMode != .editSelected {
                    canSaveStyleExample = true
                    didSaveStyleExample = false
                }

                // 保存历史
                let entry = HistoryEntry(
                    audioPath: url.path,
                    originalText: result.text,
                    processedText: finalText,
                    mode: currentMode,
                    provider: result.provider,
                    duration: duration,
                    language: result.language ?? "en",
                    appBundleID: lastAppBundleID
                )
                try? HistoryStore.shared.saveHistoryEntry(entry)

                // 自动学习词典
                dictionaryService.learnFromText(rawText)

                // UI 更新
                transcribedText = finalText
                liveText = ""
                recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)
                isProcessing = false

                // 自动插入文本
                if currentMode != .handsFree {
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
}
