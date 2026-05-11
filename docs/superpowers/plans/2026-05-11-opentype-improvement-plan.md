# OpenType 改进实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 OpenType 从"基础可用"到"生产级"的 21 项改进，分为 4 个阶段逐步实施。

**Architecture:** 遵循现有 MVVM 架构 (SwiftUI + AppKit + Services + Providers)。修改集中在 `PopoverViewModel` 流水线分流、新增服务层组件、补充测试体系。不改动现有协议接口，仅在内部扩展。

**Tech Stack:** Swift 5.9+, SwiftUI, AppKit, AVFoundation, Speech, SQLite.swift, KeychainAccess, Sparkle

---

## 文件结构总览

### 新建文件
```
OpenType/Sources/
├── Services/
│   ├── DictionaryService.swift        # 词典替换服务
│   ├── ProfileService.swift           # Profile 激活服务
│   └── NotificationService.swift      # 通知管理服务
├── UI/
│   └── Components/
│       └── ErrorBannerView.swift       # 可重用错误提示组件
Tests/
├── PopoverViewModelTests.swift
├── DictionaryServiceTests.swift
├── TextInsertionServiceTests.swift
├── HistoryStoreTests.swift
├── KeychainManagerTests.swift
└── SettingsStoreTests.swift
```

### 修改文件
```
OpenType/Sources/
├── UI/Popover/PopoverViewModel.swift   # 核心流水线重构
├── UI/Popover/PopoverView.swift        # 模式过滤 + 错误状态
├── App/AppDelegate.swift               # 快捷键热更新 + 清理
├── Services/TextInsertionService.swift # replaceSelectedText()
├── Services/AudioCaptureService.swift  # 清理方法
├── Data/HistoryStore.swift             # close() 方法
├── UI/Windows/Views/HistoryView.swift  # AVAudioPlayerDelegate
├── UI/Windows/Views/SettingsTabViews.swift # SMAppService + provider 列表
├── UI/Windows/Views/SettingsView.swift # About tab
├── Providers/Transcription/AppleSpeechProvider.swift  # 流式转写
├── Providers/Transcription/AliyunASRProvider.swift     # 签名修复
├── Providers/Transcription/TranscriptionProvider.swift # 协议扩展 + 工厂注册
├── Package.swift                       # test target + whisper.cpp
├── project.yml                         # LSUIElement + test target
└── Resources/Info.plist                # SUFeedURL
```

---

### Task 1: 词典服务 (DictionaryService)

**Files:**
- Create: `OpenType/Sources/Services/DictionaryService.swift`

- [ ] **Step 1: 创建 DictionaryService.swift**

```swift
import Foundation
import Data

public class DictionaryService {
    public static let shared = DictionaryService()
    
    private init() {}

    /// 对转写文本应用词典替换
    /// 按 term 长度降序替换，避免部分匹配问题（如 "你好世界" 不会被 "你好" 先替换掉）
    public func applyReplacements(to text: String) -> String {
        let entries = HistoryStore.shared.getAllDictionaryEntries()
        guard !entries.isEmpty else { return text }
        
        var result = text
        // 按 term 长度降序排序，长词优先替换
        let sorted = entries.sorted { $0.term.count > $1.term.count }
        for entry in sorted {
            result = result.replacingOccurrences(
                of: entry.term,
                with: entry.replacement,
                options: [.caseInsensitive, .widthInsensitive]
            )
        }
        return result
    }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd /Users/peterzhang/OpenType/OpenType && swift build 2>&1 | tail -5
```
Expected: Build succeeds (no test target yet, just verify new file compiles)

---

### Task 2: Profile 激活服务 (ProfileService)

**Files:**
- Create: `OpenType/Sources/Services/ProfileService.swift`

- [ ] **Step 1: 创建 ProfileService.swift**

```swift
import Foundation
import Data
import Models

public class ProfileService {
    public static let shared = ProfileService()
    
    private init() {}

    /// 激活指定 Profile：更新 SettingsStore 的 provider 设置
    public func activate(profile: Profile) {
        SettingsStore.shared.selectedTranscriptionProvider = profile.transcriptionProvider
        SettingsStore.shared.selectedAIProvider = profile.aiProvider
        SettingsStore.shared.lastProfileID = profile.id.uuidString
    }

    /// 获取当前激活的 Profile（如果有）
    public func getActiveProfile() -> Profile? {
        guard let idString = SettingsStore.shared.lastProfileID,
              let id = UUID(uuidString: idString) else { return nil }
        return ProfileStore.shared.getProfile(id: id)
    }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd /Users/peterzhang/OpenType/OpenType && swift build 2>&1 | tail -5
```
Expected: Build succeeds

---

### Task 3: PopoverViewModel 模式分流（核心改造）

**Files:**
- Modify: `OpenType/Sources/UI/Popover/PopoverViewModel.swift`

- [ ] **Step 1: 添加免提切换状态和依赖**

在 `PopoverViewModel` 类顶部添加：

```swift
@Published var isHandsFreeActive = false
private let dictionaryService = DictionaryService.shared
```

- [ ] **Step 2: 添加免提切换方法**

在 `startRecording(mode:)` 方法后添加：

```swift
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
```

- [ ] **Step 3: 重构 stopRecording() 按模式分流**

将现有的 `stopRecording()` 方法替换为：

```swift
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
            let finalText: String
            switch currentMode {
            case .basic:
                finalText = try await processBasicText(dictionaryText)
            case .translate:
                finalText = try await processTranslateText(dictionaryText)
            case .editSelected:
                finalText = try await processEditSelectedText(dictionaryText)
            case .handsFree:
                finalText = try await processBasicText(dictionaryText)
            }

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
            
            // 插入文本（基础模式和翻译模式自动插入）
            if currentMode != .handsFree {
                insertText()
            }
            
            // 清理临时文件
            audioService.cleanupTempFiles(keepingRecent: 20)
        } catch {
            handleError(error)
        }
    }
}

// MARK: - 模式处理

private func processBasicText(_ text: String) async throws -> String {
    guard aiService.isAvailable() else { return text }
    return try await aiService.process(text: text)
}

private func processTranslateText(_ text: String) async throws -> String {
    guard aiService.isAvailable() else { return text }
    // 获取翻译目标语言（从设置读取，默认为英文）
    let targetLanguage = SettingsStore.shared.voiceModeConfigs[.translate]?.targetLanguage ?? "en"
    return try await aiService.translate(text: text, from: "auto", to: targetLanguage)
}

private func processEditSelectedText(_ voiceCommand: String) async throws -> String {
    guard let selectedText = textInserter.getSelectedText(), !selectedText.isEmpty else {
        // 没有选中文本时，当作普通语音输入处理
        return voiceCommand
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

// MARK: - 错误处理

private func handleError(_ error: Error) {
    let message: String
    if let audioError = error as? AudioCaptureError {
        switch audioError {
        case .notPermitted: message = "麦克风权限被拒绝"
        case .noInputDevice: message = "未检测到麦克风设备"
        default: message = "录音失败: \(error.localizedDescription)"
        }
    } else if let aiError = error as? AIError {
        switch aiError {
        case .apiKeyNotFound: message = "API Key 未配置"
        default: message = "AI 处理失败"
        }
    } else {
        message = "操作失败: \(error.localizedDescription)"
    }
    
    transcribedText = ""
    isProcessing = false
    
    // 发送错误通知（供 ErrorBanner 显示）
    NotificationCenter.default.post(
        name: .transcriptionError,
        object: nil,
        userInfo: ["message": message]
    )
}
```

- [ ] **Step 4: 添加错误通知名**

在文件末尾的 `Notification.Name` 扩展中添加：

```swift
public static let transcriptionError = Notification.Name("transcriptionError")
```

- [ ] **Step 5: 编译验证**

```bash
cd /Users/peterzhang/OpenType/OpenType && swift build 2>&1
```
Expected: 可能需要处理 `VoiceModeConfig.targetLanguage` 缺失和 `AudioCaptureService.cleanupTempFiles` 缺失的编译错误（后续任务处理）

---

### Task 4: VoiceModeConfig 添加目标语言字段

**Files:**
- Modify: `OpenType/Sources/Data/VoiceModeConfig.swift`

- [ ] **Step 1: 添加 targetLanguage 字段**

读取现有 `VoiceModeConfig.swift` 文件，确认结构后添加：

```swift
public struct VoiceModeConfig: Codable {
    public var enabled: Bool
    public var targetLanguage: String  // 新增：翻译模式的目标语言
    
    public init(enabled: Bool = true, targetLanguage: String = "en") {
        self.enabled = enabled
        self.targetLanguage = targetLanguage
    }
}
```

---

### Task 5: AudioCaptureService 添加清理方法

**Files:**
- Modify: `OpenType/Sources/Services/AudioCaptureService.swift`

- [ ] **Step 1: 添加 cleanupTempFiles 方法**

在 `AudioCaptureService` 末尾添加：

```swift
public func cleanupTempFiles(keepingRecent: Int = 20) {
    let tempDir = FileManager.default.temporaryDirectory
    do {
        let files = try FileManager.default.contentsOfDirectory(
            at: tempDir,
            includingPropertiesForKeys: [.creationDateKey]
        ).filter { $0.lastPathComponent.hasPrefix("opentype_recording_") }
        
        // 按创建时间排序，保留最近的文件
        let sorted = files.sorted { a, b in
            let dateA = (try? a.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date.distantPast
            let dateB = (try? b.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date.distantPast
            return dateA > dateB
        }
        
        // 删除超出保留数量的文件
        for file in sorted.dropFirst(keepingRecent) {
            try? FileManager.default.removeItem(at: file)
        }
    } catch {
        print("Failed to cleanup temp files: \(error)")
    }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd /Users/peterzhang/OpenType/OpenType && swift build 2>&1 | tail -5
```

---

### Task 6: TextInsertionService 添加替换选中文本方法

**Files:**
- Modify: `OpenType/Sources/Services/TextInsertionService.swift`

- [ ] **Step 1: 添加 replaceSelectedText 方法**

在 `TextInsertionService` 中，`getSelectedTextViaAccessibility()` 后面添加：

```swift
public func replaceSelectedText(with newText: String) {
    // 获取当前焦点元素
    guard checkAccessibilityPermission(withPrompt: false) else {
        insertViaClipboard(newText)
        return
    }
    
    let systemWideElement = AXUIElementCreateSystemWide()
    var focusedElement: CFTypeRef?
    AXUIElementCopyAttributeValue(systemWideElement, kAXFocusedUIElementAttribute as CFString, &focusedElement)
    
    guard let element = focusedElement else {
        insertViaClipboard(newText)
        return
    }
    
    let axElement = element as! AXUIElement
    
    // 先选中全部文本（Cmd+A），再粘贴新文本
    let source = CGEventSource(stateID: .hidSystemState)
    
    // Cmd+A 选中全部
    if let selectDown = CGEvent(keyboardEventSource: source, virtualKey: 0x00, keyDown: true),
       let selectUp = CGEvent(keyboardEventSource: source, virtualKey: 0x00, keyDown: false) {
        selectDown.flags = .maskCommand
        selectUp.flags = .maskCommand
        selectDown.post(tap: .cgAnnotatedSessionEventTap)
        selectUp.post(tap: .cgAnnotatedSessionEventTap)
    }
    
    // 用 insertText 粘贴新内容
    do {
        try insertText(newText)
    } catch {
        insertViaClipboard(newText)
    }
}
```

---

### Task 7: AppDelegate 快捷键按启用状态注册 & 热更新

**Files:**
- Modify: `OpenType/Sources/App/AppDelegate.swift`

- [ ] **Step 1: setupHotkeys() 中只注册启用的模式**

修改 `setupHotkeys()` 中的 for 循环，添加启用检查：

```swift
for def in Constants.Hotkeys.defaultHotkeys {
    // 检查该模式是否启用
    if let mode = VoiceMode(rawValue: def.id), 
       let config = SettingsStore.shared.voiceModeConfigs[mode],
       !config.enabled {
        continue
    }
    // ... 其余注册逻辑不变
}
```

- [ ] **Step 2: 添加热键重注册方法**

在 `AppDelegate` 中添加：

```swift
private func setupHotkeyObserver() {
    // 监听快捷键配置变化
    NotificationCenter.default.addObserver(
        self,
        selector: #selector(reloadHotkeys),
        name: .hotkeyConfigChanged,
        object: nil
    )
}

@objc private func reloadHotkeys() {
    hotkeyService.unregisterAll()
    setupHotkeys()
}
```

在 `applicationDidFinishLaunching` 中添加 `setupHotkeyObserver()` 调用。

---

### Task 8: PopoverView 模式过滤

**Files:**
- Modify: `OpenType/Sources/UI/Popover/PopoverView.swift`

- [ ] **Step 1: 根据设置过滤显示的模式**

修改 `PopoverView` 的 body 中 Picker：

```swift
Picker("Mode", selection: $selectedMode) {
    ForEach(VoiceMode.allCases.filter { mode in
        SettingsStore.shared.voiceModeConfigs[mode]?.enabled ?? true
    }, id: \.self) { mode in
        Text(mode.displayName).tag(mode)
    }
}
```

---

### Task 9: 错误提示组件 (ErrorBannerView)

**Files:**
- Create: `OpenType/Sources/UI/Components/ErrorBannerView.swift`
- Modify: `OpenType/Sources/UI/Popover/PopoverView.swift`

- [ ] **Step 1: 创建 ErrorBannerView.swift**

```swift
import SwiftUI

struct ErrorBannerState: Identifiable {
    let id = UUID()
    let title: String
    let message: String
    let retryAction: (() -> Void)?
    let dismissAction: (() -> Void)?
    
    init(title: String, message: String, retryAction: (() -> Void)? = nil) {
        self.title = title
        self.message = message
        self.retryAction = retryAction
        self.dismissAction = nil
    }
}

struct ErrorBannerView: View {
    let state: ErrorBannerState
    @State private var isVisible = false
    
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.orange)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(state.title)
                    .font(.caption.bold())
                    .foregroundColor(.primary)
                Text(state.message)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            if let retry = state.retryAction {
                Button("重试", action: retry)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.orange.opacity(0.4), lineWidth: 1)
        )
        .padding(.horizontal, 12)
        .opacity(isVisible ? 1 : 0)
        .onAppear {
            withAnimation(.easeIn(duration: 0.2)) { isVisible = true }
        }
    }
}
```

- [ ] **Step 2: 在 PopoverView 中嵌入 ErrorBanner**

在 `PopoverView` 中添加：

```swift
@State private var errorState: ErrorBannerState?

// 在 body 中，VStack 内部、RecordingControlsView 下方添加：
if let error = errorState {
    ErrorBannerView(state: error)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                withAnimation { errorState = nil }
            }
        }
}

// 监听错误通知
.onReceive(NotificationCenter.default.publisher(for: .transcriptionError)) { notification in
    if let message = notification.userInfo?["message"] as? String {
        errorState = ErrorBannerState(title: "操作失败", message: message)
    }
}
```

- [ ] **Step 3: 编译验证**

```bash
cd /Users/peterzhang/OpenType/OpenType && swift build 2>&1 | tail -10
```

---

### Task 10: 快捷键热更新通知

**Files:**
- Modify: `OpenType/Sources/UI/Windows/Views/SettingsTabViews.swift`

- [ ] **Step 1: HotkeyRecorderButton 保存后发通知**

在 `stopRecording()` 方法中，`config = HotkeyConfig(...)` 之后添加：

```swift
NotificationCenter.default.post(name: .hotkeyConfigChanged, object: nil)
```

并在 `Notification.Name` 扩展中添加：

```swift
static let hotkeyConfigChanged = Notification.Name("hotkeyConfigChanged")
```

---

### Task 11: 开机启动 (SMAppService)

**Files:**
- Modify: `OpenType/Sources/UI/Windows/Views/SettingsTabViews.swift`

- [ ] **Step 1: 修改 Launch at Login Toggle**

将 `GeneralSettingsView` 中的：

```swift
Toggle("Launch at Login", isOn: $settings.launchAtLogin)
```

替换为：

```swift
Toggle("Launch at Login", isOn: Binding(
    get: { settings.launchAtLogin },
    set: { newValue in
        settings.launchAtLogin = newValue
        do {
            if newValue {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
        } catch {
            print("SMAppService error: \(error)")
            settings.launchAtLogin = !newValue // 回滚
        }
    }
))
```

添加 `import ServiceManagement` 在文件顶部。

---

### Task 12: 通知服务 (NotificationService)

**Files:**
- Create: `OpenType/Sources/Services/NotificationService.swift`
- Modify: `OpenType/Sources/App/AppDelegate.swift`

- [ ] **Step 1: 创建 NotificationService.swift**

```swift
import UserNotifications
import Data
import Utilities

public class NotificationService {
    public static let shared = NotificationService()
    
    private init() {}
    
    public func requestPermission() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound])
        } catch {
            return false
        }
    }
    
    public func notifyTranscriptionComplete(text: String) {
        guard SettingsStore.shared.notificationsEnabled else { return }
        
        let content = UNMutableNotificationContent()
        content.title = "转写完成"
        content.body = text.prefix(100) + (text.count > 100 ? "..." : "")
        content.sound = .default
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil // 立即发送
        )
        
        UNUserNotificationCenter.current().add(request)
    }
}
```

- [ ] **Step 2: AppDelegate 中请求通知权限**

在 `applicationDidFinishLaunching` 中添加：

```swift
Task {
    _ = await NotificationService.shared.requestPermission()
}
```

---

### Task 13: 音频回放 AVAudioPlayerDelegate 修复

**Files:**
- Modify: `OpenType/Sources/UI/Windows/Views/HistoryView.swift`

- [ ] **Step 1: HistoryDetailPanel 实现代理**

给 `HistoryDetailPanel` 添加 `NSObject, AVAudioPlayerDelegate` 协议，并在 `playAudio()` 中设置 delegate，用 `audioPlayerDidFinishPlaying` 替代 timer：

```swift
struct HistoryDetailPanel: View {
    // ... 保持现有属性
    @State private var audioDelegate: AudioPlayerDelegate?
    
    private func playAudio() {
        // ... 现有逻辑，但替换 DispatchQueue.main.asyncAfter 部分：
        let delegate = AudioPlayerDelegate { [self] in
            isPlaying = false
            audioPlayer = nil
        }
        audioDelegate = delegate
        audioPlayer?.delegate = delegate
        audioPlayer?.play()
        isPlaying = true
    }
}

private class AudioPlayerDelegate: NSObject, AVAudioPlayerDelegate {
    let onFinish: () -> Void
    init(onFinish: @escaping () -> Void) { self.onFinish = onFinish }
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        onFinish()
    }
}
```

---

### Task 14: AppDelegate 退出清理

**Files:**
- Modify: `OpenType/Sources/App/AppDelegate.swift`

- [ ] **Step 1: 完善 applicationWillTerminate**

```swift
func applicationWillTerminate(_ notification: Notification) {
    // 停止录音
    if AudioCaptureService.shared.isRecording {
        Task {
            _ = try? await AudioCaptureService.shared.stopRecording()
        }
    }
    
    // 注销快捷键
    hotkeyService.unregisterAll()
    
    // 清理临时文件
    AudioCaptureService.shared.cleanupTempFiles(keepingRecent: 0)
}
```

---

### Task 15: HistoryStore 添加 close 方法

**Files:**
- Modify: `OpenType/Sources/Data/HistoryStore.swift`

- [ ] **Step 1: 添加 close 方法**

```swift
public func close() {
    db = nil
}
```

---

### Task 16: LSUIElement 修复

**Files:**
- Modify: `OpenType/OpenType/project.yml`

- [ ] **Step 1: 修改 LSUIElement**

将 `LSUIElement: false` 改为 `LSUIElement: true`。

---

### Task 17: 阿里云 ASR 签名修复

**Files:**
- Modify: `OpenType/Sources/Providers/Transcription/AliyunASRProvider.swift`

- [ ] **Step 1: 修复签名实现**

关键修改：

```swift
// 时间戳格式改为 RFC 2616 (UTC)
private func generateTimestamp() -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
    return formatter.string(from: Date())
}

// 添加 x-acs-* 请求头
request.setValue("2022-12-14", forHTTPHeaderField: "x-acs-version")
request.setValue(timestamp, forHTTPHeaderField: "x-acs-date")
request.setValue(UUID().uuidString, forHTTPHeaderField: "x-acs-signature-nonce")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.setValue("OpenType/1.0 (macOS)", forHTTPHeaderField: "x-acs-user-agent")
```

修改签名生成函数以符合 Alibaba Cloud OpenAPI 规范 v3。

---

### Task 18: SPM 测试目标配置

**Files:**
- Modify: `OpenType/OpenType/Package.swift`

- [ ] **Step 1: 添加 test target**

在 `Package.swift` 的 targets 数组中添加：

```swift
.testTarget(
    name: "OpenTypeTests",
    dependencies: ["OpenType"],
    path: "Tests"
)
```

> 注意：由于当前项目使用 XcodeGen + SPM 混合方式，实际测试配置可能需要通过 project.yml 完成。先创建测试文件，再解决配置问题。

---

### Task 19-24: 编写 6 个测试文件

详见后续细化（建议在实际执行时按 TDD 方式逐个完成）。

---

## 执行顺序

```
Task 1-2   (服务层)   → Task 3-8   (核心重构) → 第一阶段编译验证
Task 9-12  (体验层)   → Task 13-15 (Bug 修复) → 第二阶段编译验证
Task 16-18 (配置层)   → Task 19-24 (测试)     → 第三阶段验证
```

---

## 注意事项

1. **每次任务完成后立即编译验证** — `swift build`
2. **每完成一个阶段进行 git commit**
3. **第一阶段是最关键的** — 修改 PopoverViewModel 时要特别小心，保持向后兼容
4. **测试使用内存数据库** — HistoryStoreTests 不应依赖实际的 SQLite 文件
5. **阿里云 ASR 签名修复** — 需要申请测试账号验证
