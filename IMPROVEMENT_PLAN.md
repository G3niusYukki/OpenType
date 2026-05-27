# OpenType 全面改进方案

> 基于: 代码质量分析 v0.9.0 (评分 7.0/10) + 现有功能差距
> 生成日期: 2026-05-27
> 上一版: 纯功能差距分析 (已替换)

---

## 分析摘要

**综合评分: 7.0/10** — 良好，接近生产级质量。

| 维度 | 得分 | 核心问题 |
|------|:----:|----------|
| 架构与组织 | 8 | PopoverViewModel 561 行上帝类；HistoryStore 混杂 4 类数据 |
| 代码质量 | 7 | Provider 间 90% 代码重复；硬编码过期模型名 |
| 测试 | 6 | 零集成测试；零 Provider HTTP mock 测试 |
| 文档 | 8 | 缺少 DocC 符号级文档 |
| CI/CD | 6 | Quality workflow 静默吞掉测试失败 |
| 功能完整度 | 7 | 无提示词库、无取消按钮、无增量插入 |
| 安全隐私 | 7 | 未代码签名/公证；无证书固定 |
| 可维护性 | 7 | 死代码 (OpenType-iOS/)；Shared 模块与主项目代码重复 |

---

## 总原则

1. **先质量，后功能** — 在已有代码上堆功能会增加债务，先修基础
2. **每阶段可独立交付** — 阶段之间不强制依赖，任一阶段完成后可暂停
3. **每个任务 <= 8h** — 超过则拆分
4. **每次提交必须通过 `swift build && swift test`**
5. **无新功能无测试不合并** — 新增代码必须有测试覆盖

---

## Phase 0: 质量基础设施 (v0.9.1, 预计 28h)

> **目标:** 消除系统风险，让后续工作有可靠基础。不新增任何用户可见功能。

### 0.1 修复 CI 管道 (4h, P0)

| 项 | 问题 | 改动 |
|----|------|------|
| 测试不能被吞 | `quality.yml:30` — `2>/dev/null \|\| echo "No tests"` 会静默跳过失败 | 删除 stderr 重定向；用 `set -o pipefail` + 显式 exit code |
| SwiftLint 强制执行 | `quality.yml:35-39` — swift-format 检查是可选的 | 改为 `brew install swift-format` + 非零退出时失败 |
| 代码覆盖率 | 无 | 添加 `swift test --enable-code-coverage` + 覆盖率阈值 (≥60%) |
| 依赖扫描 | 无 | 添加 Dependabot 配置 (`.github/dependabot.yml`) 监控 SPM 依赖 |

**文件:** `.github/workflows/quality.yml`, `.github/dependabot.yml`

### 0.2 清理死代码和重复 (4h, P0)

| 项 | 问题 | 改动 |
|----|------|------|
| 删除 OpenType-iOS 空壳 | `App/`, `KeyboardExtension/`, `UI/` 三个目录全空 | 删除整个 `OpenType-iOS/` 或添加 `.gitkeep` + README 说明状态 |
| 删除重复的 build 目录 | `.build`, `.build-scratch`, `.build-native` 三个并存 | 统一用 SPM 默认 `.build`；删除 scratch/native；更新 `.gitignore` |
| 同步 project.yml 版本号 | 硬编码 `0.1.0` 而实际是 `0.9.0` | 更新 `CFBundleShortVersionString` 到 `0.9.1` |
| 替换 "APPL????" 占位符 | `build-swift.yml:68` — `echo "APPL????" > PkgInfo` | 使用正确的 `APPL????` 或直接删除（非必需） |

**文件:** `OpenType-iOS/` (删除), `OpenType/project.yml`, `.github/workflows/build-swift.yml`, `OpenType/.gitignore`

### 0.3 Provider 消除重复 — HTTP Client 基类 (8h, P0)

> 这是整个方案中最重要的代码质量改进。

**当前状态:** 7 个 AI Provider + 8 个 Transcription Provider，每个都手写 `URLRequest` → `URLSession.shared.data()` → 状态码检查 → JSON 解码。`AnthropicProvider.process()` 和 `translate()` 是 90% 重复。

**目标:** 一个共享的 HTTP client 协议扩展。

```swift
// Sources/Providers/ProviderHTTPClient.swift
protocol ProviderHTTPClient {
    var session: URLSession { get }
    var decoder: JSONDecoder { get }
    var encoder: JSONEncoder { get }
}

extension ProviderHTTPClient {
    /// 标准 JSON POST 请求
    func post<T: Decodable>(url: URL, body: Encodable, headers: [String: String]) async throws -> T
    
    /// 标准 GET 请求
    func get<T: Decodable>(url: URL, headers: [String: String]) async throws -> T
    
    /// Multipart form-data 上传 (用于 Transcription)
    func uploadMultipart<T: Decodable>(url: URL, fields: [String: String], file: (name: String, filename: String, mimeType: String, data: Data), headers: [String: String]) async throws -> T
}
```

**影响范围:** 所有 15 个 Provider 文件。

**改造后 AnthropicProvider 示例:**

```swift
actor AnthropicProvider: AIProvider, ProviderHTTPClient {
    let name = "Anthropic Claude"
    let baseURL = "https://api.anthropic.com/v1"
    
    func process(prompt: String, text: String, apiKey: String, model: String?) async throws -> String {
        let body = AnthropicRequest(model: model ?? defaultModel, prompt: prompt, text: text)
        let response: AnthropicResponse = try await post(
            url: URL(string: "\(baseURL)/messages")!,
            body: body,
            headers: ["x-api-key": apiKey, "anthropic-version": "2023-06-01"]
        )
        return response.firstText
    }
    
    func translate(...) async throws -> String { process(...) } // 或直接删除
}
```

**任务拆分 (可并行):**
- 0.3a: 定义 `ProviderHTTPClient` 协议 + 扩展 (2h)
- 0.3b: 改造 7 个 AI Provider (3h)
- 0.3c: 改造 8 个 Transcription Provider (3h)

### 0.4 修复硬编码和协议改进 (4h, P0)

| 项 | 问题 | 改动 |
|----|------|------|
| AnthropicProvider 默认模型过期 | `claude-3-sonnet-20240229` 已弃用 | 改为 `claude-3-5-sonnet-20241022` + 从 SettingsStore 可配置 |
| OpenAIProvider 默认模型 | 未确认硬编码 `gpt-4o-mini` 还是其他 | 统一到 `SettingsStore.selectedAIModel` |
| AIProvider 协议去掉 translate | `translate()` 和 `process()` 在所有实现中都重复 | 改为 protocol extension 默认实现: `translate()` = `process(prompt: translationPrompt, ...)` |
| TranscriptionProvider 统一 API | 每个 Provider 自己构造 URL/请求 | 使用 Phase 0.3 的 HTTP client |

### 0.5 Provider 单元测试 (8h, P1)

> Phase 0.3 改造完成后立即写测试，防止回归。

**目标:** 每个 Provider 至少 2 个测试 (成功路径 + 错误路径)，使用 `URLProtocol` mock。

```swift
// 通用 Mock 基础设施
class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?
    override func startLoading() {
        guard let handler = MockURLProtocol.requestHandler else { fatalError() }
        let (response, data) = try handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
}

// 每个 Provider 测试
final class OpenAIProviderTests: XCTestCase {
    func testProcessSuccess() async throws { ... }
    func testProcessAPIError() async throws { ... }
}
```

**任务拆分 (可并行):**
- 0.5a: MockURLProtocol 基础设施 (1h)
- 0.5b: 7 个 AI Provider 测试 (3.5h)
- 0.5c: 8 个 Transcription Provider 测试 (3.5h)

---

## Phase 1: 架构重构 (v0.10.0, 预计 28h)

> **目标:** 拆分上帝类，消除隐式耦合，为后续功能开发扫清障碍。

### 1.1 拆分 PopoverViewModel (12h, P0)

**当前:** 561 行，协调录音 → VAD → AI → 插入 → 历史 → 编辑命令 → 快捷回答。

**拆分为 4 个 Coordinator:**

| 新类 | 职责 | 行数估算 |
|------|------|----------|
| `RecordingCoordinator` | 录音控制、VAD、实时转录、liveText 更新 | ~120 |
| `AIProcessingCoordinator` | AI 处理、流式输出、重试、failover、取消 | ~100 |
| `TextInsertionCoordinator` | 文本插入、策略链、错误处理、剪贴板保护 | ~80 |
| `PopoverViewModel` | 仅保留: @Published 状态聚合、UI 事件分发、历史刷新 | ~150 |

```
PopoverViewModel (@MainActor)
  ├── RecordingCoordinator  (录音生命周期)
  ├── AIProcessingCoordinator (AI 处理生命周期)
  └── TextInsertionCoordinator (插入策略)
```

**关键:** 每个 Coordinator 可独立测试，不再需要 mock 整个 ViewModel。

**文件:** 新建 `OpenType/Sources/Services/Coordinators/` 目录。

### 1.2 拆分 HistoryStore (6h, P1)

**当前:** 444 行，混合历史 + 词典 + 风格配置 + 语调规则。

**拆分为:**

| 新类 | 职责 |
|------|------|
| `HistoryStore` | 仅 `history` 表、CRUD、查询 |
| `DictionaryStore` | `dictionary` 表、导入导出、智能建议 |
| `StyleStore` | `style_profiles` + `style_examples` + `tone_rules` + `app_tone_rules` |

**数据库连接共享:** 三个 Store 内部共享同一个 `SQLite.Connection` (通过依赖注入)。

**文件:** `OpenType/Sources/Data/DictionaryStore.swift`, `OpenType/Sources/Data/StyleStore.swift`

### 1.3 完成 Shared 模块抽取 (6h, P1)

**当前:** `Shared/` 下有 `OpenTypeModels`, `OpenTypeCore`, `OpenTypeData`, `OpenTypeProviders`，但 `OpenType/Sources/Data/` 和 `Shared/OpenTypeData/Sources/` 存在代码重复 (`SettingsStore`, `KeychainManager`, `HistoryStore`, `VoiceModeConfig` 等)。

**目标:** 主项目 `OpenType/Sources/Data/` 删除重复文件，改为 `import OpenTypeData`。

| 步骤 | 说明 |
|------|------|
| 1. 将 `Shared/` 改为本地路径依赖 | `OpenType/Package.swift` 添加 `.package(path: "../Shared/OpenTypeData")` 等 |
| 2. 删除主项目重复文件 | `SettingsStore.swift`, `KeychainManager.swift`, `HistoryStore.swift`, `VoiceModeConfig.swift` 等 |
| 3. 更新所有 import | 主项目源码中的 `import Data` 保持不变，但实际类型来自 `OpenTypeData` |
| 4. SwiftUI Previews 修复 | 确保 Xcode 预览能找到 Shared 模块 |

### 1.4 SettingsStore 分组 (4h, P1)

**当前:** ~130 行，25 个 @Published 属性平铺。

**目标:** 用嵌套 `@Published` 结构体分组:

```swift
class SettingsStore: ObservableObject {
    @Published var transcription = TranscriptionSettings()
    @Published var ai = AISettings()
    @Published var general = GeneralSettings()
    @Published var hotkey = HotkeySettings()
    @Published var advanced = AdvancedSettings()
}

struct TranscriptionSettings: Codable {
    var selectedProvider = "Apple Speech"
    // ...
}
```

**收益:** Settings UI 可以直接 `$store.transcription.selectedProvider` 而不是 `$store.selectedTranscriptionProvider`；序列化一步到位。

---

## Phase 2: 测试深度 (v0.10.1, 预计 20h)

> **目标:** 从 6/10 提升到 8/10，消除"改了 Provider 代码但不敢确定没坏"的恐惧。

### 2.1 集成测试 — 完整流水线 (8h, P0)

**测试路径:** 模拟录音文件 → 转录 → AI 处理 → 文本插入 (不含真正的系统调用)。

```swift
final class PipelineIntegrationTests: XCTestCase {
    func testBasicDictationPipeline() async throws {
        // GIVEN: mock 录音文件 + mock HTTP 响应
        // WHEN: 走完整 pipeline
        // THEN: 最终文本正确插入，剪贴板恢复
    }
    
    func testFailoverWhenPrimaryProviderFails() async throws { ... }
    func testStreamingTextAccumulation() async throws { ... }
    func testCancelMidProcessing() async throws { ... }
}
```

### 2.2 UI 快照测试 (6h, P1)

使用 SwiftUI `PreviewSnapshots` 或 `ViewInspector`:

| 测试目标 | 说明 |
|----------|------|
| `PopoverView` 各状态 | idle / recording / processing / error / quickAnswer |
| `RecordingControlsView` | 录音中波形动画 |
| `OnboardingView` 各步骤 | 5 步的截图对比 |
| `SettingsView` 各 tab | 确保布局不错位 |

### 2.3 性能测试 (4h, P1)

| 测试目标 | 指标 | 阈值 |
|----------|------|------|
| `AudioCaptureService` 启动延迟 | 从 `startRecording()` 到首个 buffer | <200ms |
| `VADDetector` 语音检测延迟 | 从说话到 `isSpeechDetected = true` | <100ms |
| `HistoryStore` 查询 | 10000 条历史记录中查询最近 10 条 | <50ms |
| `DictionaryService` 导入 | 1000 词词典导入 | <2s |

### 2.4 边界和错误路径测试 (2h, P1)

| 测试 | 说明 |
|------|------|
| 网络超时 → 重试 → failover | RetryPolicy + ProviderFailover 组合 |
| 录音中拔出 USB 麦克风 | AudioDeviceWatcher 触发 |
| Keychain 无 API key | `AIError.apiKeyNotFound` 传播 |
| 空音频文件 | TranscriptionProvider 返回 empty 还是 error |
| 并发快速连按热键 | 防止重复录音 |

---

## Phase 3: 功能补全 (v1.0.0, 预计 50h)

> **目标:** 消除与 Typeless 的核心功能差距。沿用原 IMPROVEMENT_PLAN 的任务，但受益于 Phase 0-2 的重构基础。

### 3.1 Prompt Library 提示词库 (8h, P0) — 原 A1

**交付:**
- 内置 10+ 预设 ("Fix Grammar", "Make Formal", "Summarize", "Translate to English", "Bullet Points", "Expand", "Shorten", "Improve Writing", "Reply Email", "Explain Code")
- 用户自定义预设 (名称 + 提示词模板)
- `PromptPresetStore` (已存在) — 完善 CRUD + 默认预设注入
- UI: `PromptLibraryView` — 在 Popover 底部或侧边栏快速切换

### 3.2 AI 处理取消按钮 (4h, P0) — 原 A2

**交付:**
- Popover 中 AI 处理时显示取消按钮
- 点击后 `aiProcessingTask?.cancel()` + 恢复 `transcribedText` 为原始识别文本
- `PopoverViewModelCancelTests` (已存在) — 补充边界情况

### 3.3 增量文本插入 (16h, P0) — 原 B1

**交付:**
- `TextInsertionCoordinator.insertIncremental(text:)` — 逐字/逐句插入到光标位置
- 利用流式 AI 输出的每个 yield 触发插入
- 完成后最终文本替换所有增量文本
- 回退机制: 如果增量插入失败 → 回退到一次性插入

### 3.4 云端转录流式化 (12h, P0) — 原 B2

**交付:**
- OpenAI Whisper 流式转录 (利用 `SFSpeechAudioBufferRecognitionRequest` 已存在的 buffer 管道，发送到 Whisper API)
- Groq 流式转录
- `TranscriptionProvider.transcribeStreaming()` 协议方法对云端 provider 实现真正的流式

### 3.5 Per-App StyleProfile 自动切换 (6h, P1) — 原 A3

**交付:**
- 监听前台应用切换 → 自动切换 `StyleProfile`
- `AppProfileBindingStore` (已存在) — 完善自动激活逻辑

### 3.6 Ask Selected 模式 (4h, P1) — 原 B3

**交付:**
- 选中文本 → `⌘⇧Q` → AI 回答关于选中内容的问题
- 复用 Quick Answer 基础设施

---

## Phase 4: 生产硬化 (v1.1.0, 预计 36h)

> **目标:** 达到可放心对外分发的生产级质量。

### 4.1 代码签名 + 公证自动化 (8h, P0)

**交付:**
- CI 中集成 Apple Developer ID 签名
- `gon` 或 `notarytool` 自动公证
- DMG 签名

### 4.2 DocC 符号文档 (6h, P1)

**交付:**
- 所有 `public` 类型/方法添加 DocC 注释
- `swift package generate-documentation` 生成文档站点
- 至少覆盖: `AIProvider`, `TranscriptionProvider`, `PopoverViewModel`, `SettingsStore`, `HistoryStore`

### 4.3 证书固定 (4h, P2)

**交付:**
- 对主要的 AI/转录 API 端点添加证书固定
- 使用 `URLSessionDelegate` 实现 `urlSession(_:didReceive:completionHandler:)`

### 4.4 输入验证与安全加固 (6h, P1)

**交付:**
- API 响应 schema 严格验证 (不仅仅是 `try JSONDecoder().decode()`)
- AI 输出在插入前检查 (长度截断、非法字符过滤)
- 敏感 API key 日志脱敏

### 4.5 跨平台基础 (12h, P2) — 原 C1

**交付:**
- `Shared/` 模块完善为真正的跨平台库 (macOS + iOS + Linux)
- 消除 `import AppKit` / `import UIKit` 的平台特定依赖
- iOS App 空白项目搭建 (基于 Shared 模块)

---

## Phase 5: 差异化与护城河 (v1.2.0+, 预计 52h)

### 5.1 自动风格学习 (8h, P1) — 原 D1

### 5.2 Web 搜索集成 (12h, P2) — 原 D2

### 5.3 Ollama/LM Studio 深度集成 (8h, P2)

> OpenType 已有 Ollama provider，但文档为零。完善本地 LLM 体验。

### 5.4 Web App (80h, P2) — 原 C2

### 5.5 企业合规 (HIPAA ready, SOC2 自查) (24h, P3) — 原 D3/D4

---

## 依赖图

```
Phase 0 (质量基础: 28h)
  ├── 0.1 CI 修复        ──┐
  ├── 0.2 死代码清理     ──┤ 可并行
  ├── 0.3 HTTP Client    ──┤
  ├── 0.4 硬编码修复     ──┤
  └── 0.5 Provider 测试  ──┘ (依赖 0.3)
       │
       ▼
Phase 1 (架构重构: 28h)
  ├── 1.1 拆分 PopoverViewModel ──┐
  ├── 1.2 拆分 HistoryStore      ──┤ 可并行
  ├── 1.3 Shared 模块完成        ──┤
  └── 1.4 SettingsStore 分组     ──┘
       │
       ▼
Phase 2 (测试深度: 20h)
  ├── 2.1 集成测试     ──┐
  ├── 2.2 UI 测试      ──┤ 可并行
  ├── 2.3 性能测试     ──┤
  └── 2.4 边界测试     ──┘
       │
       ▼
Phase 3 (功能补全: 50h)
  ├── 3.1 + 3.2  (Prompt Library + Cancel) ── 可并行
  ├── 3.3 + 3.4  (增量插入 + 流式转录)     ── 可并行
  └── 3.5 + 3.6  (Per-app + Ask Selected)  ── 可并行
       │
       ▼
Phase 4 (生产硬化: 36h)
  ├── 4.1 签名公证   ──┐
  ├── 4.2 DocC       ──┤ 可并行
  ├── 4.3 证书固定   ──┤
  ├── 4.4 输入验证   ──┤
  └── 4.5 跨平台基础 ──┘
       │
       ▼
Phase 5 (差异化: 52h)
```

## 工作量汇总

| Phase | 名称 | 版本 | 工时 | 累积 |
|-------|------|------|------|------|
| 0 | 质量基础设施 | v0.9.1 | 28h | 28h |
| 1 | 架构重构 | v0.10.0 | 28h | 56h |
| 2 | 测试深度 | v0.10.1 | 20h | 76h |
| 3 | 功能补全 | v1.0.0 | 50h | 126h |
| 4 | 生产硬化 | v1.1.0 | 36h | 162h |
| 5 | 差异化 | v1.2.0+ | 52h | 214h |

## 目标评分演进

| Phase | 架构 | 代码质量 | 测试 | 文档 | CI/CD | 功能 | 安全 | 可维护性 | **总分** |
|-------|:----:|:--------:|:----:|:----:|:-----:|:----:|:----:|:--------:|:--------:|
| 当前 | 8 | 7 | 6 | 8 | 6 | 7 | 7 | 7 | **7.0** |
| Phase 0 | 8 | 8 | 7 | 8 | 7 | 7 | 7 | 7 | **7.4** |
| Phase 1 | 9 | 8 | 7 | 8 | 7 | 7 | 7 | 8 | **7.8** |
| Phase 2 | 9 | 8 | 8 | 8 | 7 | 7 | 7 | 8 | **8.0** |
| Phase 3 | 9 | 8 | 8 | 8 | 7 | 8 | 7 | 8 | **8.3** |
| Phase 4 | 9 | 9 | 8 | 9 | 8 | 8 | 9 | 9 | **8.8** |
| Phase 5 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | **9.0** |

---

## 执行策略

### 推荐顺序: 先 Phase 0 → Phase 2 (跳 Phase 1)

如果团队小，资源有限，实际最务实的策略是:

```
Phase 0 (28h) → Phase 2 (20h) → Phase 3 (50h) → Phase 4 (36h)
```

跳过 Phase 1 的大重构，把 Phase 0 的 HTTP Client 作为最小的架构改进，Phase 2 的测试直接建立在 Phase 0 基础上。Phase 1 的重构可以推迟到 Phase 3 完成后做 (因为 Phase 3 的功能开发会暴露更多 ViewModel 的边界问题)。

### 极限优先级: 只做这 3 个

如果只有 40h，只做:
1. **0.3 Provider HTTP Client 基类** (8h) — 消除最大代码异味
2. **0.5 Provider 测试** (8h) — 防止回归
3. **3.1 + 3.2 Prompt Library + Cancel** (12h) — 用户感知最强的功能差距
4. **3.3 增量插入** (12h) — 与 Typeless 的最大体验差距

---

## 提交规范

所有提交使用 Conventional Commits:

```
feat(http): add shared ProviderHTTPClient protocol
test(providers): add URLProtocol-mocked tests for all AI providers
refactor(popover): extract RecordingCoordinator from PopoverViewModel
fix(ci): stop suppressing test failures in quality workflow
chore(cleanup): remove dead OpenType-iOS scaffolding
docs(docc): add documentation for AIProvider protocol
```

每个 PR 一个任务，含 `swift build && swift test` 通过证据。

---

*基于代码质量分析生成，替换此前仅覆盖功能差距的版本。*
