# OpenType UI 重构设计文档

**版本**: v1.0
**日期**: 2026-03-23
**状态**: 已批准
**范围**: Renderer (React UI) + 部分 Main Process 重构

---

## 1. 背景与目标

### 1.1 当前状态

OpenType 0.3.x 版本存在以下 UI/UX 问题：

- **样式体系混乱**：所有组件使用 inline styles，无统一设计语言，颜色/间距/圆角硬编码在 JSX 中
- **代码重复严重**：`StatusRow`、`SetupHint`、`StatCard` 等组件逻辑高度相似但各页面自行实现
- **SettingsPage 膨胀**：单一文件超过 2600 行，逻辑无法维护
- **ProfilesPage 编辑功能空壳**：Edit 按钮无实际功能
- **Bug**：Dictionary Import 函数调用错误（调用了 Export）、UpdateModal Later 按钮逻辑错误、`animate-spin` CSS 未定义
- **UX 缺失**：无 Onboarding、无导航文字标签、无键盘快捷键帮助

### 1.2 重构目标

1. 建立统一的设计语言系统（Design Tokens）
2. 系统性消除代码重复
3. 改进关键页面的 UX（HomePage 分栏、Settings Tab 化、Onboarding 向导）
4. 修复所有已知 Bug
5. 为未来主题化（深色/浅色切换）打下基础

---

## 2. 设计系统

### 2.1 颜色系统 (CSS Variables)

```css
:root {
  /* 背景层 */
  --color-bg-base: #0a0a0f;
  --color-bg-surface: rgba(22, 22, 26, 0.85);
  --color-bg-elevated: rgba(30, 30, 38, 0.9);
  --color-bg-card: rgba(26, 26, 30, 0.8);

  /* 边框 */
  --color-border-subtle: rgba(255, 255, 255, 0.06);
  --color-border-default: rgba(255, 255, 255, 0.1);
  --color-border-strong: rgba(255, 255, 255, 0.15);

  /* 主色调 */
  --color-primary: #6366f1;
  --color-primary-hover: #7c7ff2;
  --color-primary-subtle: rgba(99, 102, 241, 0.12);
  --color-primary-border: rgba(99, 102, 241, 0.25);

  /* 强调色 */
  --color-accent: #818cf8;
  --color-accent-subtle: rgba(129, 140, 248, 0.1);

  /* 语义色 */
  --color-success: #22c55e;
  --color-success-subtle: rgba(34, 197, 94, 0.1);
  --color-error: #ef4444;
  --color-error-subtle: rgba(239, 68, 68, 0.1);
  --color-warning: #f59e0b;
  --color-warning-subtle: rgba(245, 158, 11, 0.1);

  /* 文字 */
  --color-text-primary: #f1f1f5;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #71717a;
  --color-text-disabled: #52525b;

  /* 玻璃态效果 */
  --glass-blur: blur(16px);
  --glass-bg: rgba(22, 22, 26, 0.85);
  --glass-border: rgba(255, 255, 255, 0.08);
}
```

### 2.2 间距系统

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

### 2.3 圆角系统

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

### 2.4 阴影系统

```css
:root {
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-glow-primary: 0 0 32px rgba(99, 102, 241, 0.25);
  --shadow-glow-error: 0 0 32px rgba(239, 68, 68, 0.25);
}
```

### 2.5 字体系统

沿用系统字体栈，不引入自定义字体：
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
--font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
```

---

## 3. 架构决策

### 3.1 CSS Modules

所有新编写的组件使用 **CSS Modules**（`ComponentName.module.css`），配合全局 `tokens.css` 提供设计 token。

**文件结构：**
```
src/renderer/
  styles/
    tokens.css          # 全局 CSS 变量（设计 token）
    global.css          # 重置样式 + 字体 + 滚动条
    animations.css      # 全局动画（@keyframes）
  components/
    ui/                 # 共享 UI 组件
      Button/
        Button.tsx
        Button.module.css
      Card/
        Card.tsx
        Card.module.css
      ...
    HomePage/
      HomePage.tsx
      HomePage.module.css
    SettingsPage/
      ...
```

**迁移策略**：新组件用 CSS Modules；旧组件保持不变，逐步在修改时迁移。

### 3.2 共享 UI 组件库

在 `src/renderer/components/ui/` 建立以下共享组件：

| 组件 | Props | 说明 |
|------|-------|------|
| `Button` | variant（primary/secondary/ghost/danger）, size, disabled, loading | 支持所有按钮场景 |
| `Input` | label, type, placeholder, error, disabled | 统一输入框样式 |
| `Select` | label, options, value, onChange | 自定义下拉选择 |
| `Toggle` | label, checked, onChange, description | 开关控件 |
| `Card` | glass?, padding, children | 玻璃态/实体卡片容器 |
| `Badge` | variant（success/error/warning/info） | 状态徽章 |
| `StatusRow` | icon, label, detail, status | 诊断状态行 |
| `ConfirmDialog` | title, message, confirmText, onConfirm, onCancel, danger? | 确认对话框 |
| `Modal` | title, children, onClose, size | 毛玻璃 Modal 容器 |
| `Tooltip` | content, children | 导航图标悬停提示 |
| `AnimateSpin` | - | CSS class = `animate-spin` 实际定义 |

### 3.3 Main Process 优化

保持 main process API 不变，仅优化内部结构：

- `store.ts` → 提取常量、类型定义到独立文件
- `providers.ts` → 提取 provider 配置到 `providers.config.ts`
- 不引入新依赖，不改变 IPC API

---

## 4. 页面重构详细设计

### 4.1 MainLayout

**文件**: `MainLayout.tsx` + `MainLayout.module.css`

**改动**：
- 64px 侧边栏不变
- 每个导航图标添加 `Tooltip` 组件（悬停时显示完整名称）
- 当前页面图标底部加紫色指示条（`box-shadow: inset 0 -2px 0 var(--color-primary)`）
- 毛玻璃背景（`backdrop-filter: blur(12px)`）
- 窗口拖动区域保持

**导航顺序**：Dictate → History → Dictionary → Profiles → Diagnostics → Settings

### 4.2 HomePage — 分栏布局

**文件**: `HomePage.tsx` + `HomePage.module.css`

**布局**（左 40% / 右 60%）：

```
┌─────────────────────────────────────────────────────────┐
│  [系统状态面板 - 紧凑横条]                                  │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│  左栏：录音控制区      │  右栏：转写结果 / 历史              │
│  ────────────────    │  ─────────────────────────────    │
│  Provider 下拉        │  Tab: 当前结果 | 最近 5 条        │
│  波形可视化           │                                  │
│  [ 录音按钮 ]         │  转写结果卡片                     │
│  计时器               │  Copy / Insert 按钮              │
│  快捷键提示           │                                  │
│                      │  历史列表（可滚动）                │
└──────────────────────┴──────────────────────────────────┘
```

**玻璃态效果**：
- 背景：`var(--glass-bg)` + `backdrop-filter: blur(16px)`
- 卡片边框：`1px solid var(--glass-border)`
- 阴影：`var(--shadow-md)`

**修复 Bug**：
- `AudioWaveform` 动画：`Math.random()` 移除，使用固定的 5 个 bar 高度数组，循环偏移
- `<style>` 内联标签移除，改用 CSS Module

### 4.3 SettingsPage — Tab 拆解

**文件结构**：
```
SettingsPage/
  SettingsPage.tsx       # 容器：Tab 状态 + 路由逻辑
  SettingsGeneral.tsx     # General Tab 组件
  SettingsTranscription.tsx  # Transcription + Providers Tab
  SettingsAI.tsx          # AI Post-Processing Tab
  SettingsVoiceModes.tsx  # Voice Input Modes Tab
  SettingsData.tsx        # Data Management Tab
```

**Tab 导航**：
- 顶部 Tab 栏：5 个标签，活跃 Tab 有底部紫色指示条
- Tab 切换用 React state，不引入 Router
- 每个子组件接收共享的 `showSaveIndicator` 回调

**重复 Bug 修复**：移除 SettingsPage 中的原生 `<select>` 麦克风设备选择器，统一使用 `<AudioDeviceSelector>` 组件。

### 4.4 ProfilesPage

**文件**: `ProfilesPage.tsx` + `ProfilesPage.module.css` + `ProfileEditModal.tsx`

**改动**：
- 点击 "New Profile" 或 "Edit" 弹出 `<Modal>` 毛玻璃弹窗
- Modal 内部包含表单：Profile 名称、目标 App 输入、语言选择、Provider、AI 设置
- 删除确认也用 `<ConfirmDialog>`
- Profile 列表改为网格卡片布局（每个 Profile 一个卡片）

### 4.5 HistoryPage

**文件**: `HistoryPage.tsx` + `HistoryPage.module.css`

**改动**：
- 添加音频播放按钮（使用 `<audio>` 标签 + HTMLAudioElement API）
- 修复：`FileAudio` 图标空状态文字改为中文
- 添加批量选择 + 批量删除功能

### 4.6 DictionaryPage

**文件**: `DictionaryPage.tsx` + `DictionaryPage.module.css`

**Bug 修复**：
```tsx
// 修复前（第 73 行）
const result = await window.electronAPI.dictionaryExport(format);

// 修复后
const result = await window.electronAPI.dictionaryImport(format, text);
```

### 4.7 OnboardingWizard

**新文件**: `OnboardingWizard.tsx` + `OnboardingWizard.module.css`

**4 步流程**：

| Step | 标题 | 内容 |
|------|------|------|
| 1 | Microphone Permission | 引导打开系统设置 → 隐私 → 麦克风 → 启用 OpenType |
| 2 | Accessibility Permission | 引导打开系统设置 → 隐私与安全 → 辅助功能 → 启用 OpenType |
| 3 | Transcription Provider | 选择 Provider（Local whisper.cpp / OpenAI / Groq）；Local 模式跳过 API Key；Cloud 模式引导输入 Key |
| 4 | Ready to Go | 成功状态 + 快捷键说明 + "Start Dictating" 按钮 |

**显示条件**：首次启动（`localStorage.getItem('onboardingCompleted')` 为 falsy）且未完成全部权限配置时显示。用户完成向导或手动跳过则不再显示。

### 4.8 UpdateModal Bug 修复

```tsx
// 修复前
<button onClick={() => window.electronAPI.updateCheck()}>Later</button>

// 修复后
<button onClick={() => window.electronAPI.updateDismiss()}>Later</button>
```

### 4.9 SystemStatusPanel — animate-spin 修复

在 `animations.css` 中添加：
```css
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

## 5. 迁移实施顺序

### Phase 1：基础设施（第 1-2 天）
1. 创建 `src/renderer/styles/tokens.css`
2. 创建 `src/renderer/styles/global.css` + `animations.css`
3. 建立 `src/renderer/components/ui/` 共享组件（Button, Card, Badge, Toggle, StatusRow, ConfirmDialog, Modal, Tooltip）
4. 更新 `main.tsx` 导入全局 CSS

### Phase 2：Layout 重构（第 2-3 天）
5. 重构 `MainLayout.tsx` → CSS Module + Tooltip 导航
6. 修复 `SystemStatusPanel.tsx` animate-spin

### Phase 3：HomePage 重构（第 3-4 天）
7. 重构 `HomePage.tsx` → 分栏布局 + CSS Module
8. 修复 AudioWaveform 动画

### Phase 4：Settings 重构（第 4-6 天）
9. 拆分 SettingsPage → 5 个 Tab 组件
10. 修复麦克风设备重复选择器问题

### Phase 5：其他页面（第 6-7 天）
11. 重构 `ProfilesPage.tsx` → Modal 编辑
12. 修复 `DictionaryPage.tsx` Import Bug
13. 添加 `HistoryPage.tsx` 音频播放
14. 添加 OnboardingWizard

### Phase 6：Bug 收尾（第 7 天）
15. 修复 `UpdateModal.tsx` Later 按钮
16. 全局回归检查
17. 更新 README 截图

---

## 6. 验收标准

### 6.1 视觉验收

- [ ] 所有页面使用统一的毛玻璃风格（backdrop-filter blur）
- [ ] CSS Variables 在所有新组件中正确引用
- [ ] 无 inline styles 在新组件中（除动态值如 `width: ${value}%`）
- [ ] 导航图标悬停显示 Tooltip
- [ ] `animate-spin` 在全局范围内正常工作

### 6.2 功能验收

- [ ] Dictionary Import/Export 正常工作
- [ ] UpdateModal Later 按钮正确关闭弹窗
- [ ] Profiles Edit 按钮打开 Modal 并可保存
- [ ] Onboarding 向导在首次启动时显示
- [ ] HomePage 分栏布局录音+结果同时可见
- [ ] Settings 5 个 Tab 均可正常切换和保存

### 6.3 代码质量验收

- [ ] SettingsPage 单一文件不超过 300 行
- [ ] 无 `as any` / `as unknown` 在新代码中（maintaining types）
- [ ] 共享 UI 组件覆盖所有页面中的重复代码

---

## 7. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| inline style 迁移遗漏 | 中 | 中 | 仅新组件用 CSS Module，旧组件保持不变 |
| 玻璃态性能问题（Electron） | 低 | 中 | 测试阶段验证 blur 性能，确保无掉帧 |
| Onboarding 打断用户 | 低 | 低 | 提供明确的「跳过」选项 |
| 分栏布局在小窗口下不友好 | 中 | 中 | 设置 min-width，确保在最小窗口下回退为单栏 |

---

*设计文档版本：1.0 | 批准日期：2026-03-23*
