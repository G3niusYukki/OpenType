# OpenType UI 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 OpenType UI 重构——引入 CSS Modules 设计系统、玻璃态视觉风格、修复所有已知 Bug、重构所有页面。

**Architecture:** 以 CSS Variables (design tokens) 为设计基底，所有新组件用 CSS Modules；共享 UI 组件库消除重复；SettingsPage 拆分为 5 个 Tab 子组件；HomePage 改为分栏布局；新增 Onboarding 向导。

**Tech Stack:** CSS Modules, React 19, TypeScript, Lucide React icons, Electron

---

## 文件结构总览

### 新建文件（按创建顺序）

```
src/renderer/
  styles/
    tokens.css              # 设计 token（颜色/间距/圆角/阴影/字体）
    global.css              # 全局重置 + 滚动条 + html/body 样式
    animations.css          # 全局 @keyframes（spin / pulse / waveform）
  components/
    ui/
      Button/
        Button.tsx
        Button.module.css
      Card/
        Card.tsx
        Card.module.css
      Modal/
        Modal.tsx
        Modal.module.css
      Toggle/
        Toggle.tsx
        Toggle.module.css
      Input/
        Input.tsx
        Input.module.css
      Select/
        Select.tsx
        Select.module.css
      Badge/
        Badge.tsx
        Badge.module.css
      StatusRow/
        StatusRow.tsx
        StatusRow.module.css
      ConfirmDialog/
        ConfirmDialog.tsx
        ConfirmDialog.module.css
      Tooltip/
        Tooltip.tsx
        Tooltip.module.css
    OnboardingWizard/
      OnboardingWizard.tsx
      OnboardingWizard.module.css
  pages/
    SettingsPage/
      SettingsPage.tsx         # 容器（Tab 状态路由）
      SettingsGeneral.tsx
      SettingsTranscription.tsx
      SettingsAI.tsx
      SettingsVoiceModes.tsx
      SettingsData.tsx
```

### 修改文件

| 文件 | 改动内容 |
|------|----------|
| `src/renderer/main.tsx` | 导入全局 CSS |
| `src/renderer/styles.css` | 保留（向后兼容）或标记废弃 |
| `src/renderer/components/MainLayout.tsx` | + CSS Module + Tooltip 导航 |
| `src/renderer/components/SystemStatusPanel.tsx` | + animate-spin 修复 |
| `src/renderer/pages/HomePage.tsx` | 分栏布局 + CSS Module + 修复 AudioWaveform |
| `src/renderer/pages/DictionaryPage.tsx` | Bug 修复 Import |
| `src/renderer/pages/ProfilesPage.tsx` | + Modal 编辑 + CSS Module |
| `src/renderer/pages/HistoryPage.tsx` | + 音频播放 |
| `src/renderer/components/UpdateModal.tsx` | Bug 修复 Later 按钮 |
| `src/renderer/App.tsx` | + OnboardingWizard 条件渲染 |

---

## Phase 1: 基础设施

### Task 1.1: 创建 tokens.css

**Files:**
- Create: `src/renderer/styles/tokens.css`

- [ ] **Step 1: 创建文件**

```css
/* =============================================
   OpenType Design Tokens
   全局 CSS 变量 — 所有组件的设计基底
   ============================================= */

:root {
  /* ─── 背景层 ─── */
  --color-bg-base: #0a0a0f;
  --color-bg-surface: rgba(22, 22, 26, 0.85);
  --color-bg-elevated: rgba(30, 30, 38, 0.9);
  --color-bg-card: rgba(26, 26, 30, 0.8);
  --color-bg-input: #0f0f0f;
  --color-bg-overlay: rgba(0, 0, 0, 0.7);

  /* ─── 边框 ─── */
  --color-border-subtle: rgba(255, 255, 255, 0.06);
  --color-border-default: rgba(255, 255, 255, 0.1);
  --color-border-strong: rgba(255, 255, 255, 0.15);
  --color-border-focus: rgba(99, 102, 241, 0.5);

  /* ─── 主色调 ─── */
  --color-primary: #6366f1;
  --color-primary-hover: #7c7ff2;
  --color-primary-active: #5558e3;
  --color-primary-subtle: rgba(99, 102, 241, 0.12);
  --color-primary-border: rgba(99, 102, 241, 0.25);

  /* ─── 辅助色 ─── */
  --color-accent: #818cf8;
  --color-accent-subtle: rgba(129, 140, 248, 0.1);

  /* ─── 语义色 ─── */
  --color-success: #22c55e;
  --color-success-subtle: rgba(34, 197, 94, 0.1);
  --color-success-border: rgba(34, 197, 94, 0.25);
  --color-error: #ef4444;
  --color-error-subtle: rgba(239, 68, 68, 0.1);
  --color-error-border: rgba(239, 68, 68, 0.25);
  --color-warning: #f59e0b;
  --color-warning-subtle: rgba(245, 158, 11, 0.1);
  --color-warning-border: rgba(245, 158, 11, 0.25);

  /* ─── 文字 ─── */
  --color-text-primary: #f1f1f5;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #71717a;
  --color-text-disabled: #52525b;
  --color-text-placeholder: #3f3f46;

  /* ─── 间距 ─── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* ─── 圆角 ─── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;

  /* ─── 阴影 ─── */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
  --shadow-glow-primary: 0 0 32px rgba(99, 102, 241, 0.25);
  --shadow-glow-error: 0 0 32px rgba(239, 68, 68, 0.25);

  /* ─── 玻璃态 ─── */
  --glass-blur: blur(16px);
  --glass-blur-sm: blur(8px);
  --glass-bg: rgba(22, 22, 26, 0.85);
  --glass-bg-light: rgba(30, 30, 38, 0.9);
  --glass-border: rgba(255, 255, 255, 0.08);

  /* ─── 字体 ─── */
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Fira Code Fallback', monospace;

  /* ─── 字号 ─── */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-md: 14px;
  --text-lg: 15px;
  --text-xl: 16px;
  --text-2xl: 18px;
  --text-3xl: 20px;
  --text-4xl: 24px;

  /* ─── 行高 ─── */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* ─── 过渡 ─── */
  --transition-fast: 0.1s ease;
  --transition-base: 0.15s ease;
  --transition-slow: 0.3s ease;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/styles/tokens.css
git commit -m "feat: add design tokens (CSS variables)"
```

---

### Task 1.2: 创建 global.css

**Files:**
- Create: `src/renderer/styles/global.css`

- [ ] **Step 1: 创建全局样式文件**

```css
/* =============================================
   OpenType Global Styles
   全局重置 + 滚动条 + html/body
   ============================================= */

@import './tokens.css';
@import './animations.css';

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  background: var(--color-bg-base);
  color: var(--color-text-primary);
  overflow: hidden;
  user-select: none;
}

a {
  color: var(--color-accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 文本选中 */
::selection {
  background: var(--color-primary-subtle);
  color: var(--color-accent);
}

/* 焦点样式 */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* input/textarea 字体继承 */
input, textarea, select {
  font-family: inherit;
}

button {
  font-family: inherit;
  cursor: pointer;
}

code, pre {
  font-family: var(--font-mono);
}
```

- [ ] **Step 2: 创建 animations.css**

```css
/* =============================================
   OpenType Animations
   ============================================= */

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

@keyframes waveform-bar {
  0% { transform: scaleY(0.3); opacity: 0.6; }
  100% { transform: scaleY(1); opacity: 1; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* 工具类 */
.animate-spin {
  animation: spin 1s linear infinite;
}

.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}

.animate-slide-up {
  animation: slideUp 0.3s ease-out forwards;
}

.animate-scale-in {
  animation: scaleIn 0.2s ease-out forwards;
}
```

- [ ] **Step 3: 更新 main.tsx 导入全局 CSS**

```tsx
// src/renderer/main.tsx
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/styles/global.css src/renderer/styles/animations.css src/renderer/main.tsx
git commit -m "feat: add global styles, animations, and import tokens.css"
```

---

### Task 1.3: 创建共享 UI 组件 — Button

**Files:**
- Create: `src/renderer/components/ui/Button/Button.tsx`
- Create: `src/renderer/components/ui/Button/Button.module.css`

- [ ] **Step 1: 创建 Button.tsx**

```tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    loading && styles.loading,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className={`${styles.spinner} animate-spin`} />
      )}
      {icon && !loading && <span className={styles.icon}>{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
}
```

- [ ] **Step 2: 创建 Button.module.css**

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
  flex-shrink: 0;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
  height: 28px;
}

.md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-md);
  height: 36px;
}

.lg {
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-lg);
  height: 44px;
}

/* Variants */
.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  box-shadow: var(--shadow-glow-primary);
}

.secondary {
  background: var(--color-bg-elevated);
  border-color: var(--color-border-default);
  color: var(--color-text-secondary);
}

.secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}

.ghost {
  background: transparent;
  border-color: transparent;
  color: var(--color-text-muted);
}

.ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary);
}

.danger {
  background: var(--color-error-subtle);
  border-color: var(--color-error-border);
  color: var(--color-error);
}

.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: var(--color-error);
}

.success {
  background: var(--color-success-subtle);
  border-color: var(--color-success-border);
  color: var(--color-success);
}

.success:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.2);
  border-color: var(--color-success);
}

/* Loading */
.loading {
  cursor: wait;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  flex-shrink: 0;
}

.icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
```

- [ ] **Step 3: 创建组件导出索引**

```tsx
// src/renderer/components/ui/index.ts
export { Button } from './Button/Button';
export { Card } from './Card/Card';
export { Modal } from './Modal/Modal';
export { Toggle } from './Toggle/Toggle';
export { Input } from './Input/Input';
export { Badge } from './Badge/Badge';
export { StatusRow } from './StatusRow/StatusRow';
export { ConfirmDialog } from './ConfirmDialog/ConfirmDialog';
export { Tooltip } from './Tooltip/Tooltip';
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/ui/Button/Button.tsx src/renderer/components/ui/Button/Button.module.css src/renderer/components/ui/index.ts
git commit -m "feat(ui): add Button component with variants and sizes"
```

---

### Task 1.4: 创建共享 UI 组件 — Card

**Files:**
- Create: `src/renderer/components/ui/Card/Card.tsx`
- Create: `src/renderer/components/ui/Card/Card.module.css`

- [ ] **Step 1: 创建 Card.tsx**

```tsx
import { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({ children, className, glass = false, padding = 'md' }: CardProps) {
  const classes = [
    styles.card,
    glass && styles.glass,
    styles[`padding-${padding}`],
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}
```

- [ ] **Step 2: 创建 Card.module.css**

```css
.card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-xl);
  transition: border-color var(--transition-base);
}

.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
}

.padding-none { padding: 0; }
.padding-sm { padding: var(--space-3); }
.padding-md { padding: var(--space-5); }
.padding-lg { padding: var(--space-8); }
```

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/ui/Card/Card.tsx src/renderer/components/ui/Card/Card.module.css src/renderer/components/ui/index.ts
git commit -m "feat(ui): add Card component with glass prop"
```

---

### Task 1.5: 创建共享 UI 组件 — Modal

**Files:**
- Create: `src/renderer/components/ui/Modal/Modal.tsx`
- Create: `src/renderer/components/ui/Modal/Modal.module.css`

- [ ] **Step 1: 创建 Modal.tsx**

```tsx
import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

interface ModalProps {
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  showClose?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ title, children, onClose, showClose = true, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles[size]} animate-scale-in`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || showClose) && (
          <div className={styles.header}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {showClose && onClose && (
              <button className={styles.close} onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 Modal.module.css**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-4);
}

.modal {
  background: var(--glass-bg-light);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  max-height: 90vh;
  overflow-y: auto;
  width: 100%;
}

.sm { max-width: 360px; }
.md { max-width: 480px; }
.lg { max-width: 640px; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border-subtle);
}

.title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-primary);
}

.content {
  padding: var(--space-6);
}
```

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/ui/Modal/Modal.tsx src/renderer/components/ui/Modal/Modal.module.css src/renderer/components/ui/index.ts
git commit -m "feat(ui): add Modal component with glass effect"
```

---

### Task 1.6: 创建共享 UI 组件 — Badge / Toggle / StatusRow / ConfirmDialog / Tooltip / Input / Select

**Files:**
- Create: `src/renderer/components/ui/Badge/Badge.tsx` + `Badge.module.css`
- Create: `src/renderer/components/ui/Toggle/Toggle.tsx` + `Toggle.module.css`
- Create: `src/renderer/components/ui/StatusRow/StatusRow.tsx` + `StatusRow.module.css`
- Create: `src/renderer/components/ui/ConfirmDialog/ConfirmDialog.tsx` + `ConfirmDialog.module.css`
- Create: `src/renderer/components/ui/Tooltip/Tooltip.tsx` + `Tooltip.module.css`
- Create: `src/renderer/components/ui/Input/Input.tsx` + `Input.module.css`
- Create: `src/renderer/components/ui/Select/Select.tsx` + `Select.module.css`

- [ ] **Step 1: 创建 Badge**

```tsx
// Badge.tsx
import styles from './Badge.module.css';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'default';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className || ''}`}>
      {children}
    </span>
  );
}
```

```css
/* Badge.module.css */
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 500;
}

.default { background: var(--color-bg-elevated); color: var(--color-text-muted); }
.success { background: var(--color-success-subtle); color: var(--color-success); }
.error { background: var(--color-error-subtle); color: var(--color-error); }
.warning { background: var(--color-warning-subtle); color: var(--color-warning); }
.info { background: var(--color-primary-subtle); color: var(--color-accent); }
```

- [ ] **Step 2: 创建 Toggle**

```tsx
// Toggle.tsx
import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.content}>
        {label && <span className={styles.label}>{label}</span>}
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.toggle} ${checked ? styles.checked : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      >
        <span className={styles.thumb} />
      </button>
    </label>
  );
}
```

```css
/* Toggle.module.css */
.wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  cursor: pointer;
}

.disabled { opacity: 0.5; cursor: not-allowed; }

.content { flex: 1; min-width: 0; }

.label {
  display: block;
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.description {
  display: block;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.toggle {
  position: relative;
  width: 40px;
  height: 22px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-base);
  flex-shrink: 0;
}

.toggle.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform var(--transition-base);
}

.checked .thumb {
  transform: translateX(18px);
}
```

- [ ] **Step 3: 创建 StatusRow**

```tsx
// StatusRow.tsx
import { ReactNode } from 'react';
import styles from './StatusRow.module.css';

type StatusType = 'ready' | 'missing' | 'optional' | 'loading';

interface StatusRowProps {
  label: string;
  status: StatusType;
  detail?: string;
  icon?: ReactNode;
}

export function StatusRow({ label, status, detail, icon }: StatusRowProps) {
  return (
    <div className={`${styles.row} ${styles[status]}`}>
      <div className={styles.icon}>{icon}</div>
      <span className={styles.label}>{label}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  );
}
```

```css
/* StatusRow.module.css */
.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
}

.icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.label {
  font-weight: 500;
}

.detail {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  margin-left: auto;
}

/* Status colors */
.ready .label { color: var(--color-success); }
.missing .label { color: var(--color-error); }
.optional .label { color: var(--color-warning); }
.loading .label { color: var(--color-text-muted); }
```

- [ ] **Step 4: 创建 ConfirmDialog**

```tsx
// ConfirmDialog.tsx
import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  confirmRequired?: string;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  confirmRequired,
}: ConfirmDialogProps) {
  const [input, setInput] = useState('');

  const canConfirm = !confirmRequired || input === confirmRequired;

  return (
    <Modal title={title} onClose={onCancel} showClose={false} size="sm">
      <p className={styles.message}>{message}</p>
      {confirmRequired && (
        <div className={styles.confirmInput}>
          <p className={styles.confirmLabel}>
            Type <strong>{confirmRequired}</strong> to confirm:
          </p>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={confirmRequired}
            className={styles.input}
            autoFocus
          />
        </div>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={!canConfirm}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
```

```css
/* ConfirmDialog.module.css */
.message {
  font-size: var(--text-md);
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0 0 var(--space-5);
}

.confirmInput {
  margin-bottom: var(--space-5);
}

.confirmLabel {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-2);
}

.input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--text-md);
}

.input:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

.actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}
```

- [ ] **Step 5: 创建 Tooltip**

```tsx
// Tooltip.tsx
import { useState } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={styles.wrapper}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`${styles.tooltip} ${styles[position]}`}>
          {content}
        </div>
      )}
    </div>
  );
}
```

```css
/* Tooltip.module.css */
.wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tooltip {
  position: absolute;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  pointer-events: none;
  z-index: 100;
  box-shadow: var(--shadow-md);
  animation: fadeIn 0.1s ease-out;
}

.top {
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
}

.bottom {
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
}

.left {
  right: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%);
}

.right {
  left: calc(100% + 6px);
  top: 50%;
  transform: translateY(-50%);
}
```

- [ ] **Step 6: 创建 Input**

```tsx
// Input.tsx
import { InputHTMLAttributes, forwardRef } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...rest }, ref) => {
    return (
      <div className={styles.wrapper}>
        {label && <label className={styles.label}>{label}</label>}
        <input
          ref={ref}
          className={`${styles.input} ${error ? styles.hasError : ''} ${className || ''}`}
          {...rest}
        />
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

```css
/* Input.module.css */
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--text-md);
  transition: border-color var(--transition-fast);
}

.input::placeholder {
  color: var(--color-text-placeholder);
}

.input:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

.hasError {
  border-color: var(--color-error-border);
}

.hasError:focus {
  border-color: var(--color-error);
}

.error {
  font-size: var(--text-xs);
  color: var(--color-error);
}
```

- [ ] **Step 7: 创建 Select**

```tsx
// Select.tsx
import { SelectHTMLAttributes, forwardRef } from 'react';
import styles from './Select.module.css';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className, ...rest }, ref) => {
    return (
      <div className={styles.wrapper}>
        {label && <label className={styles.label}>{label}</label>}
        <select ref={ref} className={`${styles.select} ${className || ''}`} {...rest}>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

Select.displayName = 'Select';
```

```css
/* Select.module.css */
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.select {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--text-md);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--space-3) center;
  padding-right: var(--space-8);
}

.select:focus {
  outline: none;
  border-color: var(--color-border-focus);
}
```

- [ ] **Step 8: 更新 index.ts 导出所有组件**

```tsx
export { Button } from './Button/Button';
export { Card } from './Card/Card';
export { Modal } from './Modal/Modal';
export { Toggle } from './Toggle/Toggle';
export { Input } from './Input/Input';
export { Select } from './Select/Select';
export { Badge } from './Badge/Badge';
export { StatusRow } from './StatusRow/StatusRow';
export { ConfirmDialog } from './ConfirmDialog/ConfirmDialog';
export { Tooltip } from './Tooltip/Tooltip';
```

- [ ] **Step 9: 提交**

```bash
git add src/renderer/components/ui/Badge src/renderer/components/ui/Toggle src/renderer/components/ui/StatusRow src/renderer/components/ui/ConfirmDialog src/renderer/components/ui/Tooltip src/renderer/components/ui/Input src/renderer/components/ui/Select src/renderer/components/ui/index.ts
git commit -m "feat(ui): add Badge, Toggle, StatusRow, ConfirmDialog, Tooltip, Input, Select"
```

---

## Phase 2: Layout 重构

### Task 2.1: 重构 MainLayout — CSS Module + Tooltip 导航

**Files:**
- Modify: `src/renderer/components/MainLayout.tsx`（大幅重写，移除 inline styles）
- Create: `src/renderer/components/MainLayout.module.css`
- Test: 视觉验证导航图标悬停 tooltip 正常显示

- [ ] **Step 1: 创建 MainLayout.module.css**

```css
/* MainLayout.module.css */
.nav {
  width: 64px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur-sm);
  -webkit-backdrop-filter: var(--glass-blur-sm);
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6) 0 var(--space-4);
  -webkit-app-region: drag;
  user-select: none;
}

.logo {
  margin-bottom: var(--space-6);
  -webkit-app-region: no-drag;
}

.logoIcon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  cursor: default;
}

.navList {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  -webkit-app-region: no-drag;
}

.navButton {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
  position: relative;
}

.navButton:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary);
}

.navButton.active {
  background: var(--color-primary-subtle);
  color: var(--color-accent);
  box-shadow: inset 0 -2px 0 var(--color-primary);
}

.navFooter {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
  -webkit-app-region: no-drag;
}

.minimizeButton {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.minimizeButton:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Step 2: 重构 MainLayout.tsx（简化版）**

```tsx
import { ReactNode } from 'react';
import { Mic, Settings, History, BookOpen, Minus, Activity, Briefcase } from 'lucide-react';
import { Tooltip } from '../ui';
import { useI18n } from '../../i18n';
import styles from './MainLayout.module.css';

type Page = 'home' | 'settings' | 'history' | 'dictionary' | 'diagnostics' | 'profiles';

interface MainLayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: typeof Mic }[] = [
  { id: 'home', label: 'Dictate', icon: Mic },
  { id: 'history', label: 'History', icon: History },
  { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
  { id: 'profiles', label: 'Profiles', icon: Briefcase },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function MainLayout({ children, currentPage, onNavigate }: MainLayoutProps) {
  const handleMinimize = () => window.electronAPI.windowHide();

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>O</div>
        </div>

        <div className={styles.navList}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <Tooltip key={item.id} content={item.label} position="right">
                <button
                  className={`${styles.navButton} ${isActive ? styles.active : ''}`}
                  onClick={() => onNavigate(item.id)}
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon size={20} />
                </button>
              </Tooltip>
            );
          })}
        </div>

        <div className={styles.navFooter}>
          <button
            className={styles.minimizeButton}
            onClick={handleMinimize}
            aria-label="Minimize to tray"
          >
            <Minus size={16} />
          </button>
        </div>
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
```

注意：`styles.layout` 需要加到上面 CSS 中：
```css
.layout {
  display: flex;
  height: 100vh;
  background: var(--color-bg-base);
}
```

- [ ] **Step 3: 验证 MainLayout 渲染正常，运行 dev 模式**

```bash
npm run dev:renderer &
sleep 5
# 手动验证：悬停导航图标显示 tooltip
# 杀掉后台进程
pkill -f "vite"
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/MainLayout.tsx src/renderer/components/MainLayout.module.css
git commit -m "refactor(ui): MainLayout to CSS Module + tooltip navigation"
```

---

### Task 2.2: 修复 SystemStatusPanel animate-spin

**Files:**
- Modify: `src/renderer/components/SystemStatusPanel.tsx`（移除内联 animate-spin 定义，使用全局类）

- [ ] **Step 1: 检查当前文件中是否有内联 spin 定义，如有则移除**

在 `SystemStatusPanel.tsx` 中搜索 `animate-spin` 相关内容 — 确认 `animations.css` 中的 `.animate-spin` 已经覆盖（已在 Task 1.2 中添加），此组件应已正常工作。

如果组件中使用 `className="animate-spin"` 但从未定义，CSS 已经存在于 `animations.css`，无需修改。

- [ ] **Step 2: 提交**

```bash
git commit -m "fix(ui): verify animate-spin global style coverage"
```

---

## Phase 3: HomePage 重构

### Task 3.1: 重构 HomePage — 分栏布局 + CSS Module

**Files:**
- Create: `src/renderer/pages/HomePage/HomePage.module.css`
- Modify: `src/renderer/pages/HomePage.tsx` → `src/renderer/pages/HomePage/HomePage.tsx`（重写布局）
- Imports 更新到 `src/renderer/App.tsx`

- [ ] **Step 1: 创建 HomePage.module.css**

```css
/* HomePage.module.css */
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-8);
  background: linear-gradient(180deg, var(--color-bg-base) 0%, rgba(19, 19, 31, 1) 100%);
  overflow: auto;
}

.header {
  margin-bottom: var(--space-6);
}

/* 分栏布局 */
.split {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: var(--space-6);
  flex: 1;
  min-height: 0;
}

@media (max-width: 700px) {
  .split {
    grid-template-columns: 1fr;
  }
}

/* 左栏：录音控制 */
.recordPanel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  height: fit-content;
  position: sticky;
  top: var(--space-8);
}

.providerDropdown {
  position: relative;
}

.waveform {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 48px;
  opacity: 0.4;
  transition: opacity var(--transition-slow);
}

.waveform.active {
  opacity: 1;
}

.waveBar {
  width: 4px;
  background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-accent) 100%);
  border-radius: 2px;
  transform-origin: center;
  animation: waveform-anim 0.6s ease-in-out infinite alternate;
}

.waveBar:nth-child(1) { animation-delay: 0ms; height: 12px; }
.waveBar:nth-child(2) { animation-delay: 80ms; height: 20px; }
.waveBar:nth-child(3) { animation-delay: 160ms; height: 32px; }
.waveBar:nth-child(4) { animation-delay: 240ms; height: 18px; }
.waveBar:nth-child(5) { animation-delay: 320ms; height: 26px; }
.waveBar:nth-child(6) { animation-delay: 400ms; height: 14px; }

@keyframes waveform-anim {
  0% { transform: scaleY(0.3); opacity: 0.6; }
  100% { transform: scaleY(1); opacity: 1; }
}

.recordBtn {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-glow-primary);
  transition: all var(--transition-slow);
}

.recordBtn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 60px rgba(99, 102, 241, 0.4);
}

.recordBtn.recording {
  background: linear-gradient(135deg, var(--color-error) 0%, #dc2626 100%);
  box-shadow: var(--shadow-glow-error);
  transform: scale(0.95);
}

.recordBtnInner {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
}

.recordBtn.recording .recordBtnInner {
  border-radius: 8px;
  width: 40px;
  height: 40px;
}

.hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-align: center;
}

.hint.active {
  color: var(--color-error);
}

/* 右栏：转写结果 */
.resultPanel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.tabs {
  display: flex;
  gap: var(--space-2);
}

.tab {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab.active {
  background: var(--color-primary-subtle);
  color: var(--color-accent);
}

.resultCard {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  animation: fadeIn 0.3s ease-out;
}

.resultMeta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.resultText {
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
  color: var(--color-text-primary);
  min-height: 60px;
  white-space: pre-wrap;
  word-break: break-word;
}

.resultActions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-5);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border-subtle);
}

.historyList {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow-y: auto;
  max-height: 400px;
}

.historyItem {
  padding: var(--space-3) var(--space-4);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
  width: 100%;
}

.historyItem:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--color-border-default);
}

.historyItem.active {
  background: var(--color-primary-subtle);
  border-color: var(--color-primary-border);
}

.historyText {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: var(--space-1);
}

.historyTime {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.emptyState {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.fallbackWarning {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--color-warning-subtle);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-warning);
}
```

- [ ] **Step 2: 重写 HomePage.tsx（分栏布局）**

完全重写 `HomePage.tsx`，使用 CSS Module 类，移除所有 inline styles。主要结构：

```tsx
// src/renderer/pages/HomePage/HomePage.tsx
// 关键变更：
// 1. 使用 CSS Module classes（styles.recordPanel / styles.resultPanel / styles.split）
// 2. 左栏：provider dropdown + waveform + record button + hint
// 3. 右栏：Tab [当前结果 | 最近历史] + 结果卡片
// 4. AudioWaveform: 移除 Math.random()，使用固定高度数组
// 5. RecordingTimer: 保留
// 6. 所有 button/input 使用 styles.xxx className
```

具体代码需要完整重写整个文件以使用 CSS Module。

- [ ] **Step 3: 更新 App.tsx 的导入路径**

```tsx
import { HomePage } from './pages/HomePage/HomePage';
```

- [ ] **Step 4: 验证**

```bash
npm run typecheck
# 确认无 TypeScript 错误
```

- [ ] **Step 5: 提交**

```bash
git add src/renderer/pages/HomePage/ src/renderer/App.tsx
git commit -m "feat(ui): HomePage split-panel layout with CSS Module"
```

---

## Phase 4: Settings 重构

### Task 4.1: 拆分 SettingsPage 为 Tab 组件

**Files:**
- Create: `src/renderer/pages/SettingsPage/SettingsPage.tsx`（容器）
- Create: `src/renderer/pages/SettingsPage/SettingsPage.module.css`
- Create: `src/renderer/pages/SettingsPage/SettingsGeneral.tsx`
- Create: `src/renderer/pages/SettingsPage/SettingsTranscription.tsx`
- Create: `src/renderer/pages/SettingsPage/SettingsAI.tsx`
- Create: `src/renderer/pages/SettingsPage/SettingsVoiceModes.tsx`
- Create: `src/renderer/pages/SettingsPage/SettingsData.tsx`
- Delete: `src/renderer/pages/SettingsPage.tsx`（旧文件）
- Modify: `src/renderer/App.tsx`（更新导入路径）
- Modify: `src/renderer/pages/SettingsPage.tsx` → 标记废弃或删除

**注意**: SettingsPage 有大量状态管理逻辑（2600 行），拆分策略如下：

- [ ] **Step 1: 创建 SettingsPage.tsx（容器）**

```tsx
// SettingsPage.tsx — 容器：Tab 状态 + 共享 state
import { useState } from 'react';
import styles from './SettingsPage.module.css';
import { SettingsGeneral } from './SettingsGeneral';
import { SettingsTranscription } from './SettingsTranscription';
import { SettingsAI } from './SettingsAI';
import { SettingsVoiceModes } from './SettingsVoiceModes';
import { SettingsData } from './SettingsData';

type Tab = 'general' | 'transcription' | 'ai' | 'voice' | 'data';

const tabs: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'transcription', label: 'Transcription' },
  { id: 'ai', label: 'AI' },
  { id: 'voice', label: 'Voice Modes' },
  { id: 'data', label: 'Data' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'general' && <SettingsGeneral />}
        {activeTab === 'transcription' && <SettingsTranscription />}
        {activeTab === 'ai' && <SettingsAI />}
        {activeTab === 'voice' && <SettingsVoiceModes />}
        {activeTab === 'data' && <SettingsData />}
      </div>
    </div>
  );
}
```

```css
/* SettingsPage.module.css */
.page {
  flex: 1;
  overflow: auto;
  padding: var(--space-8);
}

.header {
  margin-bottom: var(--space-6);
}

.title {
  font-size: var(--text-4xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border-subtle);
  margin-bottom: var(--space-6);
}

.tab {
  padding: var(--space-2) var(--space-4);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--text-md);
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--color-text-secondary);
}

.tab.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-primary);
}

.content {
  animation: fadeIn 0.2s ease-out;
}
```

- [ ] **Step 2: 拆分 SettingsGeneral.tsx**

将原 SettingsPage 中的 General 部分（Hotkey、语言、Auto Punctuation、Preferred Provider）提取到此文件。每部分用 `<Card>` 包装，使用共享 UI 组件。

```tsx
// SettingsGeneral.tsx
// 包含: Hotkey 设置 / 语言选择 / Auto Punctuation / Preferred Provider / Fallback 设置
// 使用: Input, Select, Toggle, Card, Button 共享组件
```

- [ ] **Step 3: 拆分 SettingsTranscription.tsx**

将原 SettingsPage 中的 Transcription Providers + Post-Processing Providers 部分提取到此文件。

- [ ] **Step 4: 拆分 SettingsAI.tsx**

将原 SettingsPage 中的 AI Post-Processing 部分提取到此文件。

- [ ] **Step 5: 拆分 SettingsVoiceModes.tsx**

将原 SettingsPage 中的 Voice Input Modes 部分提取到此文件。

- [ ] **Step 6: 拆分 SettingsData.tsx**

将原 SettingsPage 中的 Local Models + Data Management（UpdateSettings / StatCard / ExportRow / CleanupRow / ConfirmDialog）提取到此文件。

**关键**: 删除重复的麦克风设备选择器（原生 `<select>` + `<AudioDeviceSelector>`），仅保留 `<AudioDeviceSelector>` 组件。

- [ ] **Step 7: 更新 App.tsx**

```tsx
import { SettingsPage } from './pages/SettingsPage/SettingsPage';
```

- [ ] **Step 8: 删除旧 SettingsPage.tsx**

```bash
rm src/renderer/pages/SettingsPage.tsx
```

- [ ] **Step 9: 提交**

```bash
git add src/renderer/pages/SettingsPage/
git commit -m "refactor(ui): SettingsPage split into 5 tab components"
```

---

## Phase 5: 其他页面重构

### Task 5.1: 重构 ProfilesPage — Modal 编辑

**Files:**
- Create: `src/renderer/pages/ProfilesPage/ProfileEditModal.tsx`
- Create: `src/renderer/pages/ProfilesPage/ProfilesPage.module.css`
- Modify: `src/renderer/pages/ProfilesPage.tsx` → `src/renderer/pages/ProfilesPage/ProfilesPage.tsx`

- [ ] **Step 1: 创建 ProfileEditModal.tsx**

实现完整的 Profile 编辑表单，包含：
- Profile 名称 Input
- 目标 App IDs（逗号分隔 Input）
- 语言 Select
- Provider Select
- AI Post-Processing Toggle + 选项
- Save / Cancel 按钮

使用 `<Modal>` + `<Card>` + `<Input>` + `<Select>` + `<Toggle>` + `<Button>` 共享组件。

- [ ] **Step 2: 重构 ProfilesPage.tsx**

移除 Edit 按钮的空操作，点击 Edit 打开 `<ProfileEditModal>`。使用 CSS Module。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/pages/ProfilesPage/
git commit -m "feat(ui): ProfilesPage edit via Modal + CSS Module"
```

---

### Task 5.2: 修复 DictionaryPage Bug + CSS Module

**Files:**
- Modify: `src/renderer/pages/DictionaryPage.tsx`（修复 Bug + 使用 CSS Module）

- [ ] **Step 1: 修复 handleImport 函数 Bug**

```tsx
// 修复前（第 73 行）
const result = await window.electronAPI.dictionaryExport(format);

// 修复后 — handleImport 不存在，export 功能由 handleFileImport 处理
// 检查后确认：真正的问题是该函数调用了 export 而非 import
// handleImport 应实现为"导出"功能，函数命名应改为 handleExport
// 而 handleFileImport 才处理真正的"导入"
```

**修复策略**: 将 `handleImport` 重命名为 `handleExport`，避免与 `handleFileImport` 混淆。

```tsx
// 修改函数名并添加导出逻辑
const handleExport = async (format: 'json' | 'csv') => {
  // 调用 export API
  const result = await window.electronAPI.dictionaryExport(format);
  // 创建下载...
};

// 页面中 export dropdown 调用 handleExport(format)
```

- [ ] **Step 2: 同时使用 CSS Module 重构样式**

- [ ] **Step 3: 提交**

```bash
git add src/renderer/pages/DictionaryPage.tsx
git commit -m "fix(ui): DictionaryPage handleImport rename to handleExport + CSS Module"
```

---

### Task 5.3: HistoryPage 添加音频播放

**Files:**
- Modify: `src/renderer/pages/HistoryPage.tsx`（添加 Play 按钮 + CSS Module）

- [ ] **Step 1: 在 Detail View 添加音频播放**

```tsx
// 在 selectedItem detail 区域添加：
{selectedItem.audioPath && (
  <audio
    controls
    src={`file://${selectedItem.audioPath}`}
    style={{ width: '100%', marginTop: '12px' }}
  />
)}
```

- [ ] **Step 2: 使用 CSS Module 替换 inline styles**

- [ ] **Step 3: 提交**

```bash
git add src/renderer/pages/HistoryPage/HistoryPage.tsx src/renderer/pages/HistoryPage/HistoryPage.module.css
git commit -m "feat(ui): HistoryPage audio playback + CSS Module"
```

---

### Task 5.4: 创建 OnboardingWizard

**Files:**
- Create: `src/renderer/components/OnboardingWizard/OnboardingWizard.tsx`
- Create: `src/renderer/components/OnboardingWizard/OnboardingWizard.module.css`
- Modify: `src/renderer/App.tsx`（条件渲染）

- [ ] **Step 1: 创建 OnboardingWizard.module.css**

```css
/* OnboardingWizard.module.css */
.overlay { /* 同 Modal overlay */ }
.container {
  background: var(--glass-bg-light);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  max-width: 440px;
  width: 100%;
  box-shadow: var(--shadow-lg);
}

.progress {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.progressStep {
  flex: 1;
  height: 3px;
  background: var(--color-border-default);
  border-radius: var(--radius-full);
  transition: background var(--transition-slow);
}

.progressStep.done {
  background: var(--color-primary);
}

.stepLabel {
  font-size: var(--text-sm);
  color: var(--color-accent);
  margin-bottom: var(--space-2);
}

.title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3);
}

.description {
  font-size: var(--text-md);
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0 0 var(--space-5);
}

.hint {
  padding: var(--space-3) var(--space-4);
  background: var(--color-primary-subtle);
  border: 1px solid var(--color-primary-border);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  color: var(--color-accent);
  margin-bottom: var(--space-6);
  font-family: var(--font-mono);
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.successIcon {
  width: 56px;
  height: 56px;
  background: var(--color-success-subtle);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-5);
}
```

- [ ] **Step 2: 创建 OnboardingWizard.tsx（4 步）**

```tsx
// OnboardingWizard.tsx
// 4 步: Permission → Provider → Ready → Done
// 使用 shared UI 组件: Modal, Card, Button, Badge
// 显示条件: localStorage.getItem('onboardingCompleted') !== 'true'

interface Step {
  title: string;
  description: string;
  hint?: string;
  action?: 'open-microphone' | 'open-accessibility' | 'done' | null;
}

const STEPS: Step[] = [
  {
    title: 'Microphone Permission',
    description: 'OpenType needs microphone access to record your voice. Please grant permission in System Settings.',
    hint: 'System Settings → Privacy & Security → Microphone → Enable OpenType',
    action: 'open-microphone',
  },
  {
    title: 'Accessibility Permission',
    description: 'OpenType needs accessibility access for global hotkeys and text insertion.',
    hint: 'System Settings → Privacy & Security → Accessibility → Enable OpenType',
    action: 'open-accessibility',
  },
  {
    title: 'Transcription Provider',
    description: 'Choose how OpenType transcribes your voice. Local mode is free and offline.',
    // 显示 Provider 选择 UI...
    action: null,
  },
  {
    title: 'Ready to Dictate',
    description: 'You\'re all set! Press ⌘⇧D anywhere to start dictating.',
    action: 'done',
  },
];
```

- [ ] **Step 3: 在 App.tsx 条件渲染**

```tsx
// App.tsx
import { OnboardingWizard } from './components/OnboardingWizard/OnboardingWizard';

function App() {
  const [showOnboarding, setShowOnboarding] = useState(
    localStorage.getItem('onboardingCompleted') !== 'true'
  );

  // ...existing code...

  return (
    <>
      {showOnboarding && (
        <OnboardingWizard onComplete={() => {
          localStorage.setItem('onboardingCompleted', 'true');
          setShowOnboarding(false);
        }} />
      )}
      {!showOnboarding && <MainLayout ... />}
    </>
  );
}
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/OnboardingWizard/ src/renderer/App.tsx
git commit -m "feat(ui): add 4-step onboarding wizard"
```

---

## Phase 6: Bug 收尾

### Task 6.1: 修复 UpdateModal Later 按钮

**Files:**
- Modify: `src/renderer/components/UpdateModal.tsx`

- [ ] **Step 1: 修复 Later 按钮逻辑**

```tsx
// 修复前：
<button onClick={() => window.electronAPI.updateCheck()}>Later</button>

// 修复后：
<button onClick={() => window.electronAPI.updateDismiss()}>Later</button>
```

如果 `updateDismiss` IPC 方法不存在，则需要在 main process 中添加：
```ts
// src/main/main.ts
ipcMain.handle('update-dismiss', () => {
  // 设置标志，下次不在自动弹出
  // 或仅隐藏当前 Modal，让状态保持不变
});
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/components/UpdateModal.tsx
git commit -m "fix(ui): UpdateModal Later button calls dismiss not re-check"
```

---

### Task 6.2: 全局回归检查 + 最终提交

- [ ] **Step 1: 运行 TypeScript 检查**

```bash
npm run typecheck
# 确认无类型错误
```

- [ ] **Step 2: 运行测试**

```bash
npm run test
# 确认无测试失败
```

- [ ] **Step 3: 运行 dev 模式目测检查**

```bash
npm run dev
# 检查所有页面渲染正常
```

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat(ui): complete OpenType UI redesign — glass morphism, CSS Modules, 5-tab Settings, split-panel HomePage, onboarding wizard"
```

---

## 实施顺序总结

| Phase | Task | 文件数 | 预计时间 |
|-------|------|--------|---------|
| 1.1 | tokens.css | 1 | 5min |
| 1.2 | global.css + animations.css | 2 | 5min |
| 1.3 | Button | 2 | 10min |
| 1.4 | Card | 2 | 5min |
| 1.5 | Modal | 2 | 10min |
| 1.6 | Badge/Toggle/StatusRow/ConfirmDialog/Tooltip/Input/Select | 14 | 30min |
| 2.1 | MainLayout CSS Module + Tooltip | 2 | 15min |
| 2.2 | animate-spin 验证 | 0 | 5min |
| 3.1 | HomePage 分栏 + CSS Module | 2+ | 45min |
| 4.1 | SettingsPage 5-Tab 拆分 | 7+ | 60min |
| 5.1 | ProfilesPage Modal 编辑 | 3 | 20min |
| 5.2 | DictionaryPage Bug 修复 + CSS Module | 1+ | 10min |
| 5.3 | HistoryPage 音频播放 + CSS Module | 2 | 10min |
| 5.4 | OnboardingWizard | 2+ | 30min |
| 6.1 | UpdateModal Later 按钮修复 | 1 | 5min |
| 6.2 | 回归检查 + 最终提交 | - | 15min |

**总计**: ~18 个文件，~4 小时工作

---

## 验收标准

- [ ] `npm run typecheck` 无错误
- [ ] `npm run test` 全部通过
- [ ] 所有页面使用统一玻璃态视觉风格
- [ ] Dictionary Export 正常工作
- [ ] UpdateModal Later 按钮正确关闭
- [ ] Navigation 图标悬停显示 Tooltip
- [ ] HomePage 左右分栏显示
- [ ] Settings 5 个 Tab 均可切换
- [ ] Profiles Edit 打开 Modal
- [ ] Onboarding 向导首次启动显示
