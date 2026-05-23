# OpenType vs Typeless 差距分析与改进方案

> 基于 OpenType v0.8.0 (2026-05-18) 与 Typeless 2026 版本的对比

---

## 一、功能对比矩阵

| 功能 | OpenType | Typeless | 差距 |
|------|----------|----------|------|
| 实时流式听写（边说边出字） | ❌ 录完再转 | ✅ 真正实时 | 🔴 关键 |
| AI 自动编辑（去填充词/重复/改口） | ✅ 有 | ✅ 有 | 🟢 持平 |
| 意图理解（不仅仅是转录清理） | ⚠️ 基础 prompt | ✅ 深度优化 | 🟡 需改进 |
| 自动格式化（列表/步骤/要点） | ⚠️ prompt 里有但不稳定 | ✅ 稳定可靠 | 🟡 需改进 |
| Per-App 语气适配 | ✅ 有 | ✅ 有 | 🟢 持平 |
| 风格学习（Style Profile） | ✅ 有 | ✅ 有 | 🟢 持平 |
| 多语言听写（100+） | ⚠️ 自动检测但语种有限 | ✅ 100+ 语言 | 🟡 需改进 |
| 语言混合（同句多语言） | ⚠️ 分段检测 | ✅ 无缝混合 | 🟡 需改进 |
| 语音编辑命令 | ✅ 9种命令 | ✅ Speak to Edit | 🟢 持平 |
| 个人词典 | ✅ 基础 | ✅ 支持导入（如从 Gmail） | 🟡 需改进 |
| 翻译功能 | ✅ 有 | ✅ 有（更自然的本地化表达） | 🟡 需改进 |
| Whisper Mode（安静模式） | ❌ 无 | ✅ 公共场合低声听写 | 🔴 缺失 |
| Quick Answer（语音问答） | ✅ ⌘⇧Q | ❌ 无 | 🟢 领先 |
| 跨平台 | ❌ 仅 macOS | ✅ macOS/Win/iOS/Android | 🔴 关键 |
| 离线/本地模式 | ✅ Apple Speech | ⚠️ 被质疑云端处理 | 🟢 领先 |
| AI Provider 选择 | ✅ 7个 Provider | ❌ 仅内置云端 | 🟢 领先 |
| 开源/BYOK | ✅ MIT + 自带 Key | ❌ 闭源 SaaS | 🟢 领先 |
| 录音音效反馈 | ✅ 有 | ⚠️ 不明确 | 🟢 领先 |
| 流式 AI 输出 | ✅ SSE 流式 | ✅ 实时 | 🟢 持平 |
| 自动更新（Sparkle） | ✅ 有 | ✅ 有 | 🟢 持平 |
| 错误恢复/Failover | ✅ Provider 级联 | ⚠️ 不明确 | 🟢 领先 |
| Onboarding 引导 | ❌ 基本没有 | ✅ 完善的新手引导 | 🔴 缺失 |
| 定价模型 | ✅ 免费开源 | $12-30/月 SaaS | 🟢 优势 |

---

## 二、关键差距深度分析

### 差距 1：实时流式听写 (Real-time Streaming Dictation)
**严重程度：🔴 关键差距**

- **Typeless**：边说边出字，类似 Dragon NaturallySpeaking 的体验
- **OpenType**：按住说话 → 松开 → 等待转录 → 等待 AI 处理 → 插入文本
- **影响**：用户体验完全不同，实时反馈让用户感到"自然"和"无延迟"

**技术方案：**
1. 使用 `SFSpeechRecognizer` 的 `recognitionTask(with: SFSpeechAudioBufferRecognitionRequest)` 进行实时部分结果回调
2. 对云端 Provider (Whisper/Groq)，采用 VAD (Voice Activity Detection) 分段流式发送
3. 实现"两层处理"架构：
   - 第一层：实时显示原始转录（低延迟，可能不完美）
   - 第二层：AI 后处理在句末/停顿时异步替换文本
4. 参考 wispr-flow 的流式方案

**实现步骤：**
```
Phase 1: Apple Speech 实时模式
  - StreamingTranscriptionService 封装 SFSpeechRecognizer 实时回调
  - PopoverView 实时显示部分结果
  - VAD 检测停顿后触发 AI 处理

Phase 2: 云端流式 (Whisper/Groq)
  - 音频分段 (VAD 分割，每 3-5 秒一段)
  - 流式发送到 Whisper API
  - 拼接结果并实时更新

Phase 3: 两层处理融合
  - 实时粗转录 → 停顿后 AI 精修 → 替换显示
  - 用户可选择"实时插入"或"精修后插入"
```

**预计工作量：3-4 周**

---

### 差距 2：Whisper Mode（安静/低声模式）
**严重程度：🔴 缺失**

- **Typeless**：在公共场合低声说话也能准确识别
- **OpenType**：无此功能
- **影响**：限制了使用场景（咖啡厅、办公室、会议中）

**技术方案：**
1. 音频预处理增强：
   - 降噪 (Noise Gate + Spectral Subtraction)
   - 自动增益控制 (AGC) 提升低音量输入
   - 近场麦克风优化
2. Whisper API 本身对低声有较好支持，关键是前端音频处理
3. 添加"Whisper Mode"开关，切换音频处理管线

**实现步骤：**
```
1. AudioCaptureService 添加 whisperMode 属性
2. 集成 vDSP/Accelerate 框架做实时音频预处理
3. 调整 VAD 阈值（更灵敏，捕获更轻的声音）
4. Settings 中添加 Whisper Mode 开关
5. 状态栏图标区分 Whisper Mode 状态
```

**预计工作量：1-2 周**

---

### 差距 3：跨平台（iOS 优先）
**严重程度：🔴 关键差距**

- **Typeless**：macOS + Windows + iOS + Android 全平台
- **OpenType**：仅 macOS
- **影响**：丢失移动端用户群，而语音输入在移动端使用频率更高

**iOS 版本技术方案：**
1. SwiftUI 原生 iOS 应用
2. 复用 macOS 的 Models/Data/Utilities 层（Swift Package 共享）
3. iOS 特有能力：
   - Custom Keyboard Extension（全局键盘，任何 App 内语音输入）
   - Share Extension（从其他 App 分享内容到 OpenType 处理）
   - Widget（快速启动语音输入）
   - Siri Shortcut 集成
4. 文本插入改为 Keyboard Extension 输出（iOS 没有 CGEvent/AX）

**项目架构：**
```
OpenType/
├── Packages/              # 共享 Swift Packages
│   ├── OpenTypeModels/    # Models (VoiceMode, History, etc.)
│   ├── OpenTypeData/      # Data layer (Settings, Keychain, History)
│   ├── OpenTypeProviders/ # Transcription + AI providers
│   └── OpenTypeCore/      # 共享业务逻辑
├── OpenType/              # macOS App
├── OpenType-iOS/          # iOS App
│   ├── App/
│   ├── KeyboardExtension/ # Custom Keyboard
│   ├── Widgets/
│   └── UI/
└── Package.swift
```

**预计工作量：6-8 周**

---

### 差距 4：AI 意图理解与自动格式化
**严重程度：🟡 需改进**

- **Typeless**：深度理解说话意图，自动将口语转为结构化文本
- **OpenType**：有基础 prompt 但格式化不够稳定
- **影响**：输出质量不如竞品，用户需要手动修正

**改进方案：**
1. **优化 System Prompt**：
   - 更详细的格式化指令（何时用列表、何时用段落）
   - 添加输出格式示例（few-shot）
   - 针对不同场景的 prompt 模板
2. **后处理管线增强**：
   - 检测列表意图（"第一…第二…第三…" → 编号列表）
   - 检测步骤意图（"首先…然后…最后…" → 有序列表）
   - 检测要点意图（"关于 X…还有 Y…" → 无序列表）
3. **两段式 AI 处理**（可选高级模式）：
   - 第一段：清理（去填充词/重复/改口）
   - 第二段：格式化 + 润色
4. **用户可配置的格式化规则**：
   - "总是使用列表格式化步骤"
   - "邮件中使用正式语气"
   - "代码相关讨论保留技术术语"

**预计工作量：2-3 周**

---

### 差距 5：Onboarding 与首次体验
**严重程度：🔴 缺失**

- **Typeless**：完善的新手引导、教程、示例
- **OpenType**：几乎没有引导，用户需要自己摸索
- **影响**：新用户流失，功能发现率低

**改进方案：**
1. **首次启动向导**（First Launch Wizard）：
   - Step 1: 欢迎 + 权限授予引导（Mic/Speech/Accessibility）
   - Step 2: 选择转录 Provider（推荐 Apple Speech 零配置上手）
   - Step 3: 配置 AI Provider（可选，可跳过）
   - Step 4: 快捷键展示 + 测试录音
   - Step 5: 完成 → 第一次语音输入引导
2. **交互式教程**：
   - Popover 中的 tips carousel
   - "试试这个"按钮引导用户体验每个模式
3. **快捷键提示 Overlay**：
   - 前 5 次使用时显示快捷键提示气泡

**预计工作量：1-2 周**

---

### 差距 6：个人词典增强
**严重程度：🟡 需改进**

- **Typeless**：支持从邮件/文档导入常用词
- **OpenType**：基础的手动添加词典
- **影响**：专业术语识别率低

**改进方案：**
1. **词典导入**：
   - 从文本文件批量导入
   - 从剪贴板历史提取高频词
   - 从指定文档/文件夹提取专业术语
2. **智能词典建议**：
   - 检测反复修正的词 → 提示加入词典
   - 检测转录结果中的 OOV (Out-of-Vocabulary) 词
3. **词典分类**：
   - 通用词典 / 专业词典 / App 特定词典
   - 可启用/禁用不同分类

**预计工作量：1 周**

---

## 三、优先级排序与里程碑

### Phase 1: 体验打磨 (v0.9.0) — 预计 3 周
> 目标：在现有架构内最大化用户体验

| # | 任务 | 优先级 | 工作量 |
|---|------|--------|--------|
| 1 | Onboarding 首次启动向导 | P0 | 1 周 |
| 2 | AI Prompt 优化（意图理解 + 自动格式化） | P0 | 1 周 |
| 3 | Whisper Mode（安静模式） | P1 | 1 周 |
| 4 | 词典增强（导入 + 智能建议） | P2 | 0.5 周 |

### Phase 2: 实时流式 (v1.0.0) — 预计 4 周
> 目标：达到 Typeless 的核心体验 — 边说边出字

| # | 任务 | 优先级 | 工作量 |
|---|------|--------|--------|
| 1 | Apple Speech 实时流式转录 | P0 | 1.5 周 |
| 2 | 云端 Provider 流式 (VAD 分段) | P0 | 1.5 周 |
| 3 | 两层处理架构（实时粗转 + 异步精修） | P0 | 1 周 |

### Phase 3: 跨平台 (v1.1.0) — 预计 6-8 周
> 目标：iOS 版本上线

| # | 任务 | 优先级 | 工作量 |
|---|------|--------|--------|
| 1 | 代码重构为共享 Swift Packages | P1 | 1 周 |
| 2 | iOS App 主体 + Keyboard Extension | P0 | 3 周 |
| 3 | iOS Widget + Siri Shortcut | P2 | 1 周 |
| 4 | TestFlight 测试 + App Store 上架 | P1 | 1-2 周 |

### Phase 4: 差异化 (v1.2.0+) — 持续
> 目标：超越 Typeless，发挥开源 + BYOK 优势

| # | 任务 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | 本地 LLM 后处理 (Ollama/MLX) | P1 | 完全离线 AI 润色 |
| 2 | 自定义 AI Pipeline（用户可编排多步处理） | P2 | 开源独有优势 |
| 3 | 插件系统（社区开发的 Provider/功能） | P2 | 生态建设 |
| 4 | 语音命令扩展（自定义命令） | P2 | 用户可定义语音宏 |
| 5 | 多设备同步（iCloud Sync） | P2 | 设置/词典/历史同步 |
| 6 | Windows 版（Electron/Tauri 复用旧代码） | P3 | 看资源决定 |

---

## 四、OpenType 的独特优势（保持并发扬）

这些是 Typeless 没有的，要继续保持：

1. **开源 + BYOK** — 用户完全控制，无订阅费
2. **7 个 AI Provider** — 用户选择权，不被锁定
3. **离线模式** — Apple Speech 完全本地，真正的隐私
4. **Provider Failover** — 一个挂了自动切下一个
5. **Quick Answer 模式** — Typeless 没有的语音问答
6. **Style Profile + Few-shot** — 从示例学习写作风格
7. **诊断工具** — 系统级问题排查
8. **健康监控** — 长时间运行稳定性保障

---

## 五、技术债务与架构改进

在实现新功能的同时，建议同步处理：

1. **模块化解耦**：将 Sources/ 重组为 Swift Packages，为 iOS 共享做准备
2. **测试覆盖率**：从 67 个测试提升到 150+，覆盖核心流程
3. **CI/CD**：GitHub Actions 自动化构建 + 测试 + Release
4. **文档**：API 文档 (DocC) + 用户手册
5. **性能基准**：转录延迟、AI 处理延迟的基准测试

---

## 六、竞品参考

| 产品 | 特点 | 可借鉴 |
|------|------|--------|
| **Typeless** | 实时流式、跨平台、自动格式化 | 核心体验标杆 |
| **Superwhisper** | 本地 Whisper、隐私优先 | 离线体验参考 |
| **Wispr Flow** | 实时听写、企业合规 | 流式方案参考 |
| **BossAI** | 低价、Boss Mode 屏幕阅读 | 差异化功能灵感 |
| **Google AI Edge Eloquent** | 免费、离线 Gemma ASR | 本地模型方向 |
| **Voibe** | 买断制 $99 终身 | 定价模型参考 |

---

*最后更新：2026-05-23*
*基于 OpenType v0.8.0 分析*
