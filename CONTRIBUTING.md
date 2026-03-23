# Contributing to OpenType

First off, thank you for considering contributing to OpenType! It's people like you that make OpenType such a great tool.

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please:

1. **Check existing issues** to see if the problem has already been reported
2. **Use the latest version** to verify the bug still exists
3. **Collect information** about the bug:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - System information (macOS version, OpenType version)
   - Error messages or logs

**Submit a bug report**: [New Issue](https://github.com/G3niusYukki/OpenType/issues/new?template=bug_report.md)

### Suggesting Features

Feature suggestions are welcome! Please:

1. **Check existing issues** for similar suggestions
2. **Explain the use case** - What problem does it solve?
3. **Describe the solution** you'd like to see
4. **Consider alternatives** you've thought about

**Submit a feature request**: [New Issue](https://github.com/G3niusYukki/OpenType/issues/new?template=feature_request.md)

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** if applicable
4. **Update documentation** as needed
5. **Ensure the build passes**: `npm run build`
6. **Submit a pull request** with a clear description

## 🚀 Development Workflow

### Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/OpenType.git
cd OpenType

# Install dependencies
npm install

# Install required tools
brew install ffmpeg

# Optional: Install whisper.cpp for local transcription
brew install whisper.cpp

# Download a Whisper model
mkdir -p "~/Library/Application Support/OpenType/models"
curl -L -o "~/Library/Application Support/OpenType/models/ggml-base.bin" \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
```

### Running Development Mode

```bash
# Start all watchers (main, preload, renderer)
npm run dev

# Or run individually:
npm run dev:main      # Watch main process
npm run dev:preload   # Watch preload script
npm run dev:renderer  # Vite dev server
```

### Project Structure

```
src/
├── main/              # Electron main process
│   ├── main.ts        # Entry point
│   ├── store.ts       # Configuration
│   ├── audio-capture.ts      # Recording
│   ├── transcription.ts      # ASR
│   ├── aiPostProcessor.ts    # AI processing
│   ├── text-inserter.ts      # Text insertion
│   └── providers.ts          # Provider management
├── preload/           # Preload script
└── renderer/          # React frontend
    ├── pages/         # Route pages (each in subdirectory with .tsx + .module.css)
    │   ├── HomePage/
    │   ├── SettingsPage/    # 5-tab container
    │   ├── ProfilesPage/
    │   ├── HistoryPage/
    │   └── DictionaryPage/
    ├── components/
    │   ├── ui/          # Shared UI library (Button, Card, Modal...)
    │   ├── MainLayout.tsx   # App shell with nav
    │   └── OnboardingWizard/  # First-launch wizard
    └── styles/          # Global CSS
        ├── tokens.css       # Design tokens (CSS custom properties)
        ├── global.css      # Reset, scrollbar, base styles
        └── animations.css  # Keyframe animations
```

### CSS Modules

The renderer uses **CSS Modules** for scoped component styling. Each component has its own `.module.css` file.

- **Design tokens** (`tokens.css`) — All CSS custom properties defined in `:root`
- **Class naming** — Use `.camelCase` in CSS, `styles.camelCase` in JSX
- **Global animations** — Keyframes in `animations.css`, used as `className="animate-fade-in"`
- **Glass effects** — Use `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-blur)`

### Coding Standards

#### TypeScript

- Use **strict TypeScript** (`strict: true` in tsconfig)
- **No `any` types** - use proper types or `unknown` with type guards
- **Explicit return types** for public functions
- **Interfaces over types** for object shapes

```typescript
// Good
interface AudioConfig {
  sampleRate: number;
  channels: 1 | 2;
}

async function startRecording(config: AudioConfig): Promise<RecordingResult> {
  // implementation
}

// Bad
function startRecording(config: any): any {
  // implementation
}
```

#### Code Style

- **2 spaces** for indentation
- **Single quotes** for strings
- **Semicolons** required
- **No trailing commas** (multiline)

```typescript
// Good
const result = {
  success: true,
  data: {
    text: 'hello',
    confidence: 0.95
  }
};

// Bad
const result = {
  success: true,
  data: {
    text: "hello",
    confidence: 0.95,
  },
};
```

#### Comments

- **Minimal comments** - code should be self-explanatory
- **Document WHY, not WHAT** - explain business logic, not syntax
- **Public API documentation** with JSDoc

```typescript
/**
 * Process text through AI post-processing
 * @param text - Raw transcribed text
 * @param options - Processing options (filler words, repetition, etc.)
 * @returns Processed text with change tracking
 */
async function process(text: string, options: ProcessOptions): Promise<ProcessResult> {
  // Implementation explains itself through good naming
}
```

#### Error Handling

- **Always handle errors** - no empty catch blocks
- **Use specific error types** when possible
- **Log errors** with context
- **Show user-friendly messages** for UI errors

```typescript
// Good
try {
  await audioCapture.start();
} catch (error) {
  console.error('[AudioCapture] Failed to start:', error);
  
  if (error.message === 'MICROPHONE_PERMISSION_DENIED') {
    showPermissionDialog();
  } else {
    showErrorDialog('Failed to start recording', error.message);
  }
}

// Bad
try {
  await audioCapture.start();
} catch (error) {
  // Silent failure
}
```

### Testing

The project uses **Vitest** for unit testing. All tests are located in `tests/unit/`.

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- tests/unit/HomePage.test.tsx
```

**Test patterns:**
- Renderer tests mock `window.electronAPI` via `tests/unit/mocks/electronAPI.ts`
- Tests use `@testing-library/react` for component rendering
- Use `vi.useFakeTimers()` for time-dependent logic (debounces, timeouts)

Always run `npm run test` before submitting a PR. All existing tests must pass.

### Commit Messages

Use conventional commits format:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

**Examples:**

```
feat(transcription): add DeepSeek ASR provider

fix(audio): handle microphone permission denied error

docs(readme): update installation instructions

refactor(ai): simplify prompt building logic
```

### Documentation

Update documentation for any changes:

- **README.md** - User-facing features
- **Code comments** - Complex logic
- **Type definitions** - Public APIs

## 🎯 Areas for Contribution

### High Priority

- [ ] **Chinese ASR Providers** - Implement 阿里云, 腾讯云, 百度, 科大讯飞
- [x] **Unit Tests** - Core test suite in place (365 tests); expand coverage for main process and edge cases
- [ ] **Documentation** - Improve inline documentation

### Medium Priority

- [ ] **New Voice Input Modes** - Suggest and implement new modes
- [ ] **Performance Optimization** - Reduce memory usage, improve latency
- [x] **UI/UX Improvements** - Glass morphism UI, CSS Modules, 5-tab Settings, Onboarding Wizard (done in v0.4)
- [ ] **Internationalization** - Add more languages

### Good First Issues

- [ ] **Bug fixes** - Check issues labeled `good first issue`
- [ ] **UI Polish** - Small visual improvements
- [ ] **Documentation** - Fix typos, clarify instructions
- [ ] **Provider Configs** - Add new model options

## 📝 Commit Checklist

Before submitting a PR, ensure:

- [ ] Code follows style guidelines
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] All tests pass (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No `console.log` statements (use proper logging)
- [ ] Error handling is robust
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format

## 🏷️ Release Process

Maintainers will:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a git tag: `git tag v0.2.0`
4. Push tag: `git push origin v0.2.0`
5. Create GitHub Release with notes
6. Attach built binaries

## 💬 Community

- **Discussions**: Use [GitHub Discussions](https://github.com/G3niusYukki/OpenType/discussions) for questions and ideas
- **Issues**: Use [GitHub Issues](https://github.com/G3niusYukki/OpenType/issues) for bugs and features
- **Code of Conduct**: Follow our [Code of Conduct](CODE_OF_CONDUCT.md)

## ❓ Questions?

Feel free to:
- Open an issue with your question
- Start a discussion
- Contact maintainers through GitHub

Thank you for contributing! 🎉
