# OpenType 改进方案设计文档

> 基于当前代码库的分析，识别出 21 项待改进项，分为 4 个阶段逐步完成。

**日期:** 2026-05-11  
**版本:** 1.0  
**状态:** 待实施

---

## 总体架构

当前 OpenType 的代码架构（协议、工厂模式、数据层）搭建得比较完整，但核心业务流水线（`PopoverViewModel`）只实现了基础模式。翻译、编辑、免提模式均未打通。Profile/词典功能有 UI 无后端接入。且零测试覆盖。

改进策略：**先打通核心流水线，再完善用户体验，然后建立测试体系和修 Bug，最后做功能增强。**

---

## 第一阶段：打通核心流水线

### 目标

四种语音模式的基础模式已经跑通，需要让翻译、编辑、免提三种模式也正确工作，同时让词典和 Profile 系统真正生效。

### 1.1 PopoverViewModel 模式分流

**当前问题:** `stopRecording()` 中所有四种模式走完全相同的流水线（录音→转写→AI处理→保存→插入）。

**改造方案:** `stopRecording()` 改为 switch-case，按 mode 走不同分支：

| 模式 | 流水线 |
|------|--------|
| `basic` | 录音 → 转写 → 词典替换 → AI处理 → 插入 |
| `translate` | 录音 → 转写 → 词典替换 → AI翻译 (`aiService.translate()`) → 插入 |
| `editSelected` | 获取选中文本 → 录音 → 转写 → AI编辑（prompt 包含原文+指令）→ 替换选中 |
| `handsFree` | 切换开始/停止（首次=开始录音，二次=停止并走 basic 流水线） |

**翻译模式 Prompt:**

```
将以下文本从 auto 翻译成 {targetLanguage}。只返回翻译结果：
{text}
```

**编辑模式 Prompt:**

```
原始文本：
{selectedText}

编辑指令：
{voiceCommand}

根据编辑指令修改原始文本。只返回修改后的文本。
```

### 1.2 免提模式切换逻辑

在 `PopoverViewModel` 中增加 `isHandsFreeActive` 状态。`startHandsFree()` 和 `stopHandsFree()` 方法处理切换。`StatusBarController` 监听 `hotkeyHandsFree` 通知并触发 ViewModel 的切换。

### 1.3 词典系统接入

**新建 `DictionaryService.swift`：**

```swift
public class DictionaryService {
    public static let shared = DictionaryService()
    
    /// 对转写文本应用词典替换
    /// 按 term 长度降序替换，避免部分匹配问题
    public func applyReplacements(to text: String) -> String {
        let entries = HistoryStore.shared.getAllDictionaryEntries()
        var result = text
        // 按 term 长度降序排序，避免短词先替换导致长词无法匹配
        for entry in entries.sorted(by: { $0.term.count > $1.term.count }) {
            result = result.replacingOccurrences(of: entry.term, with: entry.replacement)
        }
        return result
    }
}
```

在 `PopoverViewModel.stopRecording()` 中，所有模式在 AI 处理前先调用 `DictionaryService.shared.applyReplacements()`。

### 1.4 Profile 系统接入

**新建 `ProfileService.swift`：**

激活 Profile 时更新 `SettingsStore` 的 transcription provider 和 AI provider 设置。

在 `PopoverView` 或 `PopoverViewModel` 中增加 Profile 切换 UI（从 ProfileStore 读取当前激活的 Profile）。

### 1.5 语音模式开关生效

- `PopoverView.swift`：根据 `SettingsStore.shared.voiceModeConfigs` 过滤 segmented picker 中显示的模式
- `AppDelegate.setupHotkeys()`：只注册启用的模式对应的快捷键

### 1.6 涉及文件

| 文件 | 改动 |
|------|------|
| `Sources/UI/Popover/PopoverViewModel.swift` | 重构 stopRecording()，模式分流 |
| `Sources/UI/Popover/PopoverView.swift` | 模式过滤；Profile 切换 UI |
| `Sources/App/AppDelegate.swift` | 快捷键按启用状态注册 |
| `Sources/Services/TextInsertionService.swift` | 新增 `replaceSelectedText()` |
| `Sources/Services/DictionaryService.swift` | 新建 — 词典替换服务 |
| `Sources/Services/ProfileService.swift` | 新建 — Profile 激活服务 |

---

## 第二阶段：完善用户体验

### 2.1 错误提示 UI

**新建 `ErrorBannerView.swift`：**

可重用的 SwiftUI 错误提示组件，支持：
- 错误图标 + 标题 + 详情文字
- 可选的"重试"按钮
- 可选的"关闭"按钮
- 从顶部滑入动画

在 `PopoverView` 中嵌入，由 `PopoverViewModel` 的 `@Published var errorState: ErrorBannerState?` 驱动。

**ErrorBannerState 模型：**
```swift
struct ErrorBannerState: Identifiable {
    let id = UUID()
    let title: String
    let message: String
    let retryAction: (() -> Void)?
    let dismissAction: (() -> Void)?
}
```

### 2.2 快捷键热更新

**当前问题:** `AppDelegate.setupHotkeys()` 仅在 `applicationDidFinishLaunching` 中调用一次。

**改造方案:** 
1. `HotkeyRecorderButton` 在保存快捷键后发送通知
2. `AppDelegate` 监听通知，调用 `hotkeyService.unregisterAll()` 然后重新注册
3. 新增 `reloadHotkeys()` 方法在 `AppDelegate` 中

### 2.3 临时文件自动清理

- `PopoverViewModel.stopRecording()` 中：`HistoryEntry` 保存后，删除旧的临时文件（保留最近 20 个）
- `AudioCaptureService` 新增 `cleanupTempFiles(keepingRecent: Int)` 方法
- `AppDelegate.applicationWillTerminate()` 中调用清理

### 2.4 开机启动实现

在 `GeneralSettingsView` 的 `launchAtLogin` Toggle 中集成 `SMAppService.mainApp`：

```swift
Toggle("Launch at Login", isOn: $settings.launchAtLogin)
    .onChange(of: settings.launchAtLogin) { newValue in
        do {
            if newValue {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
        } catch {
            print("SMAppService error: \(error)")
        }
    }
```

### 2.5 通知功能

**新建 `NotificationService.swift`：**

```swift
public class NotificationService {
    public static let shared = NotificationService()
    
    public func requestPermission() async -> Bool { ... }
    public func notifyTranscriptionComplete(text: String) { ... }
    public func notifyHandsFreeTimeout() { ... }
}
```

在 `AppDelegate.applicationDidFinishLaunching()` 中请求通知权限。在 `PopoverViewModel` 转写完成后（非前台时）发送通知。

### 2.6 涉及文件

| 文件 | 改动 |
|------|------|
| `Sources/UI/Components/ErrorBannerView.swift` | 新建 |
| `Sources/UI/Popover/PopoverView.swift` | 嵌入 ErrorBanner |
| `Sources/App/AppDelegate.swift` | 热键重注册 + 清理 + 通知 |
| `Sources/UI/Windows/Views/SettingsTabViews.swift` | SMAppService 集成 |
| `Sources/Services/NotificationService.swift` | 新建 |
| `Sources/Services/AudioCaptureService.swift` | 添加清理方法 |

---

## 第三阶段：稳定性 & 测试

### 3.1 单元测试体系

**创建 `Tests/` 目录，配置 SPM test target：**

| 测试文件 | 覆盖内容 |
|----------|----------|
| `PopoverViewModelTests.swift` | 四种模式流水线分流；词典替换；免提切换；错误状态 |
| `DictionaryServiceTests.swift` | 替换正确性；边界情况（空词典、空文本、特殊字符） |
| `TextInsertionServiceTests.swift` | 插入策略回退（CGEvent→AppleScript→Clipboard）；escaped 文本 |
| `HistoryStoreTests.swift` | CRUD 操作；数据库未初始化错误 |
| `KeychainManagerTests.swift` | 保存/读取/删除；多 provider 隔离；多凭证 |
| `SettingsStoreTests.swift` | 默认值正确性；持久化；编码/解码 |

测试原则：Mock 外部依赖（URLSession、Keychain、SQLite），聚焦业务逻辑。

### 3.2 LSUIElement 修复

`project.yml` 中 `LSUIElement: false` → `LSUIElement: true`。应用变为纯菜单栏应用。

### 3.3 音频回放 Delegate 修复

`HistoryDetailPanel` 实现 `AVAudioPlayerDelegate`，在 `audioPlayerDidFinishPlaying` 中清理状态。

### 3.4 应用退出清理

`AppDelegate.applicationWillTerminate()` 增加：
- 停止当前录音（如果正在录音）
- 关闭 SQLite 连接（`HistoryStore.shared.close()`）
- 清理临时文件
- 注销快捷键

### 3.5 阿里云 ASR 签名修复

参照 Alibaba Cloud POP API 签名规范 v3：
- 时间戳格式：`yyyy-MM-dd'T'HH:mm:ss'Z'`（UTC）
- 增加 `x-acs-action`、`x-acs-version`、`x-acs-signature-nonce`、`x-acs-date` 请求头
- `canonicalRequest` 应包含 HTTP method、path、query string、canonical headers、signed headers、body hash

### 3.6 涉及文件

| 文件 | 改动 |
|------|------|
| `Tests/PopoverViewModelTests.swift` 等 6 个文件 | 新建 |
| `project.yml` | LSUIElement + test target 配置 |
| `Sources/UI/Windows/Views/HistoryView.swift` | AVAudioPlayerDelegate |
| `Sources/App/AppDelegate.swift` | 退出清理 |
| `Sources/Providers/Transcription/AliyunASRProvider.swift` | 签名修复 |
| `Sources/Data/HistoryStore.swift` | 添加 close() 方法 |

---

## 第四阶段：功能增强

### 4.1 流式实时转写

**AppleSpeechProvider 改造：**

- 当前使用 `SFSpeechURLRecognitionRequest`（文件式，转写完成后才有结果）
- 改用 `SFSpeechAudioBufferRecognitionRequest`（流式，边说边出字）
- AudioCaptureService 音频 buffer 直接送入 speech recognizer
- 通过 `AsyncStream<String>` 返回实时转写片段
- `TranscriptionProvider` 协议新增可选 `transcribeStreaming()` 方法

### 4.2 本地离线转写 (whisper.cpp)

- 通过 SPM 集成 `whisper.cpp`（社区维护的 Swift 封装）
- 创建 `WhisperCPPProvider` 实现 `TranscriptionProvider`
- 模型管理 UI：下载/删除 GGML 模型文件
- 使用 Metal 加速（如果可用）

### 4.3 更多中文 ASR 提供商

**三个新 Provider，均实现 `TranscriptionProvider` 协议：**

| Provider | API | 认证方式 |
|----------|-----|----------|
| `TencentASRProvider` | 腾讯云实时语音识别 | TC3-HMAC-SHA256 |
| `BaiduASRProvider` | 百度短语音识别 | OAuth2 Bearer Token |
| `IFlytekASRProvider` | 科大讯飞语音听写 | WebSocket + HMAC-SHA256 |

在 `TranscriptionProviderFactory` 中注册，在 `TranscriptionSettingsView` 中列出。

### 4.4 关于页面

**新建 `AboutSettingsView.swift`：**
- 显示应用图标（从 Bundle 读取）
- 版本号和构建号（`CFBundleShortVersionString` / `CFBundleVersion`）
- GitHub 仓库链接
- 许可证链接
- 致谢信息

在 `SettingsView` 中新增第 6 个 Tab。

### 4.5 Sparkle 更新源配置

- 确保 `Resources/Info.plist` 中设置 `SUFeedURL` 为 GitHub Releases appcast
- 测试更新检测、下载、安装流程

### 4.6 涉及文件

| 文件 | 改动 |
|------|------|
| `Sources/Providers/Transcription/AppleSpeechProvider.swift` | 重构 — 流式支持 |
| `Sources/Providers/Transcription/WhisperCPPProvider.swift` | 新建 |
| `Sources/Providers/Transcription/TencentASRProvider.swift` | 新建 |
| `Sources/Providers/Transcription/BaiduASRProvider.swift` | 新建 |
| `Sources/Providers/Transcription/IFlytekASRProvider.swift` | 新建 |
| `Sources/Providers/Transcription/TranscriptionProvider.swift` | 协议扩展 + 工厂注册 |
| `Sources/UI/Windows/Views/AboutSettingsView.swift` | 新建 |
| `Sources/UI/Windows/Views/SettingsView.swift` | 新增 About Tab |
| `Sources/UI/Windows/Views/SettingsTabViews.swift` | 更新 provider 列表 |
| `Package.swift` | whisper.cpp 依赖 |
| `project.yml` | 新增文件路径 |
| `Resources/Info.plist` | SUFeedURL |

---

## 执行顺序

```
第一阶段 (2-3天)     第二阶段 (1-2天)     第三阶段 (2-3天)     第四阶段 (3-5天)
    │                    │                    │                    │
    ├─ 模式分流          ├─ 错误提示 UI       ├─ 单元测试          ├─ 流式转写
    ├─ 免提切换          ├─ 快捷键热更新      ├─ LSUIElement       ├─ whisper.cpp
    ├─ 词典接入          ├─ 临时文件清理      ├─ 音频委托          ├─ 三个 ASR
    ├─ Profile 接入      ├─ 开机启动          ├─ 退出清理          ├─ 关于页面
    └─ 模式开关          └─ 通知功能          └─ 签名修复          └─ 更新配置
```

---

## 风险与注意事项

1. **第一阶段风险最低** — 主要是修改现有流水线逻辑，不引入新依赖
2. **第二阶段需注意** — SMAppService 需要 macOS 13+，但项目已设定 deployment target 13.0
3. **第三阶段测试需配置** — SPM test target 需要在 `Package.swift` 中正确配置，或使用 Xcode project test target
4. **第四阶段 whisper.cpp** — SPM 集成可能复杂，社区封装质量不一，需要评估后选择可靠方案
5. **阿里云 ASR 签名修复** — 需要在阿里云控制台实际测试验证
6. **三个中文 ASR** — 每个都需要申请开发者账号和测试 API 调用
