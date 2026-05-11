import SwiftUI
import AppKit
import Models
import Services
import Data

@MainActor
class PopoverViewModel: ObservableObject {
    @Published var isRecording = false
    @Published var isProcessing = false
    @Published var transcribedText = ""
    @Published var recentHistory: [HistoryEntry] = []
    @Published var currentMode: VoiceMode = .basic
    @Published var isHandsFreeActive = false

    private let audioService = AudioCaptureService.shared
    private let transcriptionService = TranscriptionService.shared
    private let aiService = AIProcessingService.shared
    private let textInserter = TextInsertionService.shared
    private let dictionaryService = DictionaryService.shared

    init() {
        recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)
    }

    func startRecording(mode: VoiceMode) {
        currentMode = mode
        isRecording = true
        transcribedText = ""

        Task {
            do {
                try await audioService.startRecording()
            } catch {
                print("Failed to start recording: \(error)")
                isRecording = false
                postError("录音启动失败: \(error.localizedDescription)")
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
        isProcessing = true

        Task {
            do {
                let (url, duration) = try await audioService.stopRecording()
                let result = try await transcriptionService.transcribe(audioURL: url)

                // 词典替换
                let dictionaryText = dictionaryService.applyReplacements(to: result.text)

                // 按模式分流处理
                let finalText = try await processForMode(dictionaryText, audioURL: url)

                // 保存历史
                let entry = HistoryEntry(
                    audioPath: url.path,
                    originalText: result.text,
                    processedText: finalText,
                    mode: currentMode,
                    provider: result.provider,
                    duration: duration,
                    language: result.language ?? "en"
                )
                try? HistoryStore.shared.saveHistoryEntry(entry)

                // UI 更新
                transcribedText = finalText
                recentHistory = HistoryStore.shared.getRecentHistory(limit: 3)
                isProcessing = false

                // 自动插入文本（hands-free 模式不自动插入，由用户手动触发）
                if currentMode != .handsFree {
                    if currentMode == .editSelected {
                        textInserter.replaceSelectedText(with: finalText)
                    } else {
                        insertText()
                    }
                }

                // 清理临时文件
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
        return try await aiService.process(text: text)
    }

    private func processTranslate(_ text: String) async throws -> String {
        guard aiService.isAvailable() else { return text }
        let targetLanguage = SettingsStore.shared.voiceModeConfigs[.translate]?.targetLanguage ?? "en"
        return try await aiService.translate(text: text, from: "auto", to: targetLanguage)
    }

    private func processEditSelected(_ voiceCommand: String) async throws -> String {
        // 获取选中的文本
        guard let selectedText = textInserter.getSelectedText(), !selectedText.isEmpty else {
            // 没有选中文本时当作普通语音输入
            return try await processBasic(voiceCommand)
        }

        guard aiService.isAvailable() else { return selectedText }

        // 构建编辑 prompt
        let prompt = """
        原始文本：
        \(selectedText)

        编辑指令：
        \(voiceCommand)

        根据编辑指令修改原始文本。只返回修改后的文本，不要添加任何解释。
        """
        return try await aiService.process(text: prompt)
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

    func insertText() {
        do {
            try textInserter.insertText(transcribedText)
        } catch {
            print("Text insertion failed, falling back to clipboard: \(error)")
            copyToClipboard(transcribedText)
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
