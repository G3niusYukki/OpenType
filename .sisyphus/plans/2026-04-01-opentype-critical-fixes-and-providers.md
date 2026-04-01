# OpenType Critical Fixes & Provider Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical bugs (fake audio metering, hardcoded providers), build provider infrastructure, add missing transcription/AI providers, and improve error handling for production reliability.

**Architecture:** 
- Phase 0: Test infrastructure setup (foundation for TDD)
- Phase 1: Critical bug fixes
- Phase 2: Provider infrastructure and stub providers
- Phase 3: Implement AI providers fully
- Phase 4: Add transcription providers
- Phase 5: UI/UX polish

**Tech Stack:** Swift5.9, SwiftUI, AVFoundation, XCTest, SQLite.swift

---

## Phase 0: Test Infrastructure Setup

### Task 0.1: Add XCTest Target

**Files:**
- Modify: `OpenType/project.yml`
- Create: `OpenType/Tests/OpenTypeTests.swift`

- [ ] **Step 1: Add test target and scheme to project.yml**

```yaml
# In project.yml, add test target after main target:
targets:
  OpenTypeTests:
    type: bundle.unit-test
    platform: macOS
    sources:
      - path: Tests
    dependencies:
      - target: OpenType
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.opentype.macos.tests

# Add scheme configuration to enable testing:
schemes:
  OpenType:
    build:
      targets:
        OpenType: all
        OpenTypeTests: testing
    test:
      targets:
        - OpenTypeTests
```

```swift
// OpenType/Tests/OpenTypeTests.swift
import XCTest
@testable import OpenType

final class OpenTypeTests: XCTestCase {
    func testPlaceholder() {
        // Placeholder - will be replaced with real tests
        XCTAssertTrue(true)
    }
}
```

- [ ] **Step 3: Regenerate Xcode project and verify**

```bash
cd OpenType && xcodegen generate
xcodebuild test -project OpenType.xcodeproj -scheme OpenType -destination 'platform=macOS'
```

**Expected:** Build succeeds, 1 test passes

- [ ] **Step 4: Commit**

```bash
git add OpenType/project.yml OpenType/Tests/
git commit -m "test: add XCTest infrastructure for TDD"
```

---

## Phase 1: Critical Bug Fixes (Independent Tasks)

### Task 1.1: Fix Fake Audio Level Metering

**Files:**
- Modify: `OpenType/Sources/Services/AudioCaptureService.swift:115-118`

- [ ] **Step 1: Add real RMS audio metering in processAudioBuffer**

In `processAudioBuffer`, after writing to audioFile, calculate audio level from buffer:

```swift
// After line 103 (try? audioFile.write(from: convertedBuffer)):
// Calculate audio level from buffer
if let channelData = buffer.floatChannelData {
    let channelDataValue = channelData[0]
    let frameLength = Int(buffer.frameLength)
    
    var sumSquares: Float = 0
    for i in 0..<frameLength {
        sumSquares += channelDataValue[i] * channelDataValue[i]
    }
    let rms = sqrt(sumSquares / Float(frameLength))
    let db = rms > 0 ? 20 * log10(rms) : -160
    
    Task { @MainActor [weak self] in
        self?.audioLevel = db
    }
}
```

- [ ] **Step 2: Remove timer-based fake metering**

Delete:
- `levelTimer` property (line 24)
- `startLevelMeter()` method (lines 107-113)
- `updateAudioLevel()` method (lines 115-118)

In `startRecording()` (line 80), remove the call `startLevelMeter()`.

- [ ] **Step 3: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds with no errors

- [ ] **Step 4: Manual QA**

1. Run app
2. Start recording
3. Verify audio level changes smoothly (not jumpy random values)
4. Speak loudly → level should increase
5. Stay silent → level should approach -160

- [ ] **Step 5: Commit**

```bash
git add OpenType/Sources/Services/AudioCaptureService.swift
git commit -m "fix: replace fake audio level with real RMS metering"
```

---

### Task 1.2: Fix TranscriptionService.getAvailableProviders()

**Files:**
- Modify: `OpenType/Sources/Services/TranscriptionService.swift:18-20`

- [ ] **Step 1: Return all implemented providers**

```swift
public func getAvailableProviders() -> [TranscriptionProvider] {
    return [
        AppleSpeechProvider(),
        OpenAIWhisperProvider(),
        GroqTranscriptionProvider()
    ]
}
```

- [ ] **Step 2: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 3: Commit**

```bash
git add OpenType/Sources/Services/TranscriptionService.swift
git commit -m "fix: return all transcription providers in getAvailableProviders()"
```

---

### Task 1.3: Remove fatalError in HistoryStore

**Files:**
- Modify: `OpenType/Sources/Data/HistoryStore.swift:79, 158`

- [ ] **Step 1: Replace fatalError with proper error throwing**

Line 77-80, replace:
```swift
guard let db = db else {
    fatalError("HistoryStore used without valid database connection")
}
```

With:
```swift
guard let db = db else {
    throw HistoryStoreError.databaseNotInitialized
}
```

Line 156-159, same replacement.

- [ ] **Step 2: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 3: Commit**

```bash
git add OpenType/Sources/Data/HistoryStore.swift
git commit -m "fix: replace fatalError with proper error throwing in HistoryStore"
```

---

## Phase 2: Provider Infrastructure

### Task 2.1: Add Model Configuration to SettingsStore

**Files:**- Modify: `OpenType/Sources/Data/SettingsStore.swift`

- [ ] **Step 1: Add model properties**

```swift
// After line 19 (selectedAIProvider):
@Published public var selectedTranscriptionModel: String {
    didSet { defaults.set(selectedTranscriptionModel, forKey: "selectedTranscriptionModel") }
}

@Published public var selectedAIModel: String {
    didSet { defaults.set(selectedAIModel, forKey: "selectedAIModel") }
}
```

- [ ] **Step 2: Add initialization in init()**

```swift
// After line 58 (lastProfileID initialization):
selectedTranscriptionModel = defaults.string(forKey: "selectedTranscriptionModel") ?? "whisper-1"
selectedAIModel = defaults.string(forKey: "selectedAIModel") ?? "gpt-4o-mini"
```

- [ ] **Step 3: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 4: Commit**

```bash
git add OpenType/Sources/Data/SettingsStore.swift
git commit -m "feat: add model configuration properties to SettingsStore"
```

---

### Task 2.2: Update AIProvider Protocol with Model Parameter

**Files:**
- Modify: `OpenType/Sources/Providers/AI/AIProvider.swift`

- [ ] **Step 1: Update protocol**

```swift
public protocol AIProvider: Sendable {
    var name: String { get }
    var defaultModel: String { get }
    var availableModels: [String] { get }
    
    func process(text: String, model: String, apiKey: String) async throws -> String
    func removeFillers(text: String, model: String, apiKey: String) async throws -> String
    func translate(text: String, from: String, to: String, model: String, apiKey: String) async throws -> String
}
```

- [ ] **Step 2: Update OpenAIProvider to conform**

```swift
public actor OpenAIProvider: AIProvider {
    public let name = "OpenAI"
    public let defaultModel = "gpt-4o-mini"
    public let availableModels = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"]
    
    public init() {}
    
    public func process(text: String, model: String, apiKey: String) async throws -> String {
        // Use model parameter instead of hardcoded "gpt-3.5-turbo"
        return try await sendRequest(prompt: "...", model: model.isEmpty ? defaultModel : model, apiKey: apiKey)
    }
    
    public func removeFillers(text: String, model: String, apiKey: String) async throws -> String {
        return try await process(text: text, model: model, apiKey: apiKey)
    }
    
    public func translate(text: String, from: String, to: String, model: String, apiKey: String) async throws -> String {
        let prompt = "Translate from \(from) to \(to):\n\n\(text)"
        return try await sendRequest(prompt: prompt, model: model.isEmpty ? defaultModel : model, apiKey: apiKey)
    }
    
    private func sendRequest(prompt: String, model: String, apiKey: String) async throws -> String {
        // Implementation with model parameter
    }
}
```

- [ ] **Step 3: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 4: Commit**

```bash
git add OpenType/Sources/Providers/AI/AIProvider.swift OpenType/Sources/Providers/AI/OpenAIProvider.swift
git commit -m "feat: add model parameter to AIProvider protocol"
```

---

### Task 2.3: Create Stub AI Providers

**Files:**
- Create: `OpenType/Sources/Providers/AI/GroqAIProvider.swift`
- Create: `OpenType/Sources/Providers/AI/AnthropicProvider.swift`
- Create: `OpenType/Sources/Providers/AI/DeepSeekProvider.swift`
- Create: `OpenType/Sources/Providers/AI/ZhipuProvider.swift`
- Create: `OpenType/Sources/Providers/AI/MiniMaxProvider.swift`
- Create: `OpenType/Sources/Providers/AI/MoonshotProvider.swift`

- [ ] **Step 1: Create GroqAIProvider stub**

```swift
// OpenType/Sources/Providers/AI/GroqAIProvider.swift
import Foundation

public actor GroqAIProvider: AIProvider {
    public let name = "Groq"
    public let defaultModel = "llama-3.3-70b-versatile"
    public let availableModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    
    public init() {}
    
    public func process(text: String, model: String, apiKey: String) async throws -> String {
        fatalError("Not implemented - will be implemented in Phase 3")
    }
    
    public func removeFillers(text: String, model: String, apiKey: String) async throws -> String {
        fatalError("Not implemented - will be implemented in Phase 3")
    }
    
    public func translate(text: String, from: String, to: String, model: String, apiKey: String) async throws -> String {
        fatalError("Not implemented - will be implemented in Phase 3")
    }
}
```

- [ ] **Step 2: Create AnthropicProvider stub**

```swift
// OpenType/Sources/Providers/AI/AnthropicProvider.swift
import Foundation

public actor AnthropicProvider: AIProvider {
    public let name = "Anthropic"
    public let defaultModel = "claude-3-5-sonnet-20241022"
    public let availableModels = ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"]
    
    public init() {}
    
    public func process(text: String, model: String, apiKey: String) async throws -> String {
        fatalError("Not implemented - will be implemented in Phase 3")
    }
    
    public func removeFillers(text: String, model: String, apiKey: String) async throws -> String {
        fatalError("Not implemented - will be implemented in Phase 3")
    }
    
    public func translate(text: String, from: String, to: String, model: String, apiKey: String) async throws -> String {
        fatalError("Not implemented - will be implemented in Phase 3")
    }
}
```

- [ ] **Step 3: Create remaining stubs (DeepSeek, Zhipu, MiniMax, Moonshot)**

Same pattern with fatalError stubs.

- [ ] **Step 4: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds (stubs compile)

- [ ] **Step 5: Commit**

```bash
git add OpenType/Sources/Providers/AI/*.swift
git commit -m "feat: add stub AI providers for factory pattern"
```

---

### Task 2.4: Create AIProviderFactory

**Files:**
- Create: `OpenType/Sources/Providers/AI/AIProviderFactory.swift`

- [ ] **Step 1: Create factory matching TranscriptionProviderFactory pattern**

```swift
// OpenType/Sources/Providers/AI/AIProviderFactory.swift
import Foundation

public enum AIProviderFactory {
    public static func makeProvider(name: String) -> any AIProvider {
        switch name {
        case "OpenAI": return OpenAIProvider()
        case "Groq": return GroqAIProvider()
        case "Anthropic": return AnthropicProvider()
        case "DeepSeek": return DeepSeekProvider()
        case "Zhipu": return ZhipuProvider()
        case "MiniMax": return MiniMaxProvider()
        case "Moonshot": return MoonshotProvider()
        default: return OpenAIProvider()
        }
    }
    
    public static func availableProviders() -> [any AIProvider] {
        return [
            OpenAIProvider(),
            GroqAIProvider(),
            AnthropicProvider(),
            DeepSeekProvider(),
            ZhipuProvider(),
            MiniMaxProvider(),
            MoonshotProvider()
        ]
    }
    
    public static func providerNames() -> [String] {
        return ["OpenAI", "Groq", "Anthropic", "DeepSeek", "Zhipu", "MiniMax", "Moonshot"]
    }
}
```

- [ ] **Step 2: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 3: Commit**

```bash
git add OpenType/Sources/Providers/AI/AIProviderFactory.swift
git commit -m "feat: add AIProviderFactory for provider selection"
```

---

### Task 2.5: Update AIProcessingService to use Factory

**Files:**
- Modify: `OpenType/Sources/Services/AIProcessingService.swift`

- [ ] **Step 1: Refactor to use factory and settings**

```swift
import Foundation
import Providers
import Data

public class AIProcessingService: @unchecked Sendable {
    public static let shared = AIProcessingService()
    private init() {}

    public func process(text: String, apiKey: String) async throws -> String {
        let providerName = SettingsStore.shared.selectedAIProvider
        let provider = AIProviderFactory.makeProvider(name: providerName)
        let model = SettingsStore.shared.selectedAIModel
        return try await provider.process(text: text, model: model, apiKey: apiKey)
    }

    public func removeFillers(text: String, apiKey: String) async throws -> String {
        let providerName = SettingsStore.shared.selectedAIProvider
        let provider = AIProviderFactory.makeProvider(name: providerName)
        let model = SettingsStore.shared.selectedAIModel
        return try await provider.removeFillers(text: text, model: model, apiKey: apiKey)
    }

    public func translate(text: String, from: String, to: String, apiKey: String) async throws -> String {
        let providerName = SettingsStore.shared.selectedAIProvider
        let provider = AIProviderFactory.makeProvider(name: providerName)
        let model = SettingsStore.shared.selectedAIModel
        return try await provider.translate(text: text, from: from, to: to, model: model, apiKey: apiKey)
    }
}
```

- [ ] **Step 2: Delete old hardcoded translate implementation**

Remove the entire `translate` method implementation (lines 19-47) and replace with the factory-based version above.

- [ ] **Step 3: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 4: Commit**

```bash
git add OpenType/Sources/Services/AIProcessingService.swift
git commit -m "refactor: AIProcessingService uses AIProviderFactory and settings"
```

---

## Phase 3: Implement AI Providers

### Task 3.1: Create OpenAI-Compatible Base Provider

**Files:**
- Create: `OpenType/Sources/Providers/AI/OpenAICompatibleProvider.swift`

- [ ] **Step 1: Create shared implementation**

```swift
// OpenType/Sources/Providers/AI/OpenAICompatibleProvider.swift
import Foundation

public struct OpenAICompatibleConfig {
    public let baseURL: String
    public let defaultModel: String
    public let availableModels: [String]
    
    public static let openAI = OpenAICompatibleConfig(
        baseURL: "https://api.openai.com/v1",
        defaultModel: "gpt-4o-mini",
        availableModels: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"]
    )
    
    public static let groq = OpenAICompatibleConfig(
        baseURL: "https://api.groq.com/openai/v1",
        defaultModel: "llama-3.3-70b-versatile",
        availableModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
    )
    
    public static let deepSeek = OpenAICompatibleConfig(
        baseURL: "https://api.deepseek.com",
        defaultModel: "deepseek-chat",
        availableModels: ["deepseek-chat", "deepseek-coder"]
    )
    
    public static let moonshot = OpenAICompatibleConfig(
        baseURL: "https://api.moonshot.cn/v1",
        defaultModel: "moonshot-v1-8k",
        availableModels: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]
    )
    
    public static let zhipu = OpenAICompatibleConfig(
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        defaultModel: "glm-4",
        availableModels: ["glm-4", "glm-4-flash", "glm-3-turbo"]
    )
    
    public static let minimax = OpenAICompatibleConfig(
        baseURL: "https://api.minimax.chat/v1",
        defaultModel: "abab6.5s-chat",
        availableModels: ["abab6.5s-chat", "abab6.5g-chat"]
    )
}

public actor OpenAICompatibleProvider: AIProvider {
    public let name: String
    public let defaultModel: String
    public let availableModels: [String]
    private let config: OpenAICompatibleConfig
    
    public init(name: String, config: OpenAICompatibleConfig) {
        self.name = name
        self.config = config
        self.defaultModel = config.defaultModel
        self.availableModels = config.availableModels
    }
    
    public func process(text: String, model: String, apiKey: String) async throws -> String {
        return try await sendRequest(
            prompt: "Process the following transcribed text. Remove filler words, fix repetitions, and clean up self-corrections:\n\n\(text)",
            model: model,
            apiKey: apiKey
        )
    }
    
    public func removeFillers(text: String, model: String, apiKey: String) async throws -> String {
        return try await sendRequest(
            prompt: "Remove filler words from this text, keeping meaning:\n\n\(text)",
            model: model,
            apiKey: apiKey
        )
    }
    
    public func translate(text: String, from: String, to: String, model: String, apiKey: String) async throws -> String {
        return try await sendRequest(
            prompt: "Translate from \(from) to \(to). Return only the translation:\n\n\(text)",
            model: model,
            apiKey: apiKey
        )
    }
    
    private func sendRequest(prompt: String, model: String, apiKey: String) async throws -> String {
        let url = URL(string: "\(config.baseURL)/chat/completions")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "model": model.isEmpty ? config.defaultModel : model,
            "messages": [
                ["role": "system", "content": "You are a text processing assistant."],
                ["role": "user", "content": prompt]
            ],
            "temperature": 0.3
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }
        
        struct Response: Codable {
            struct Choice: Codable {
                struct Message: Codable { let content: String }
                let message: Message
            }
            let choices: [Choice]
        }
        
        let result = try JSONDecoder().decode(Response.self, from: data)
        return result.choices.first?.message.content ?? ""
    }
}
```

- [ ] **Step 2: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 3: Commit**

```bash
git add OpenType/Sources/Providers/AI/OpenAICompatibleProvider.swift
git commit -m "feat: add OpenAI-compatible provider base implementation"
```

---

### Task3.2: Implement All AI Providers

**Files:**
- Rewrite: `OpenType/Sources/Providers/AI/OpenAIProvider.swift`
- Rewrite: `OpenType/Sources/Providers/AI/GroqAIProvider.swift`
- Rewrite: `OpenType/Sources/Providers/AI/DeepSeekProvider.swift`
- Rewrite: `OpenType/Sources/Providers/AI/ZhipuProvider.swift`
- Rewrite: `OpenType/Sources/Providers/AI/MiniMaxProvider.swift`
- Rewrite: `OpenType/Sources/Providers/AI/MoonshotProvider.swift`
- Rewrite: `OpenType/Sources/Providers/AI/AnthropicProvider.swift`

- [ ] **Step 1: Update OpenAIProvider to use shared implementation**

```swift
// OpenType/Sources/Providers/AI/OpenAIProvider.swift
import Foundation

public actor OpenAIProvider: AIProvider {
    private let wrapped: OpenAICompatibleProvider
    
    public let name = "OpenAI"
    public var defaultModel: String { wrapped.defaultModel }
    public var availableModels: [String] { wrapped.availableModels }
    
    public init() {
        self.wrapped = OpenAICompatibleProvider(name: "OpenAI", config: .openAI)
    }
    
    public func process(text: String, model: String, apiKey: String) async throws -> String {
        return try await wrapped.process(text: text, model: model, apiKey: apiKey)
    }
    
    public func removeFillers(text: String, model: String, apiKey: String) async throws -> String {
        return try await wrapped.removeFillers(text: text, model: model, apiKey: apiKey)
    }
    
    public func translate(text: String, from: String, to: String, model: String, apiKey: String) async throws -> String {
        return try await wrapped.translate(text: text, from: from, to: to, model: model, apiKey: apiKey)
    }
}
```

- [ ] **Step 2: Update GroqAIProvider, DeepSeekProvider, MoonshotProvider, ZhipuProvider, MiniMaxProvider**

Same pattern using OpenAICompatibleProvider with respective configs.

- [ ] **Step 3: Implement AnthropicProvider (different API)**

```swift
// OpenType/Sources/Providers/AI/AnthropicProvider.swift
import Foundation

public actor AnthropicProvider: AIProvider {
    public let name = "Anthropic"
    public let defaultModel = "claude-3-5-sonnet-20241022"
    public let availableModels = ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"]
    
    public init() {}
    
    public func process(text: String, model: String, apiKey: String) async throws -> String {
        return try await sendRequest(prompt: "...", model: model, apiKey: apiKey)
    }
    
    public func removeFillers(text: String, model: String, apiKey: String) async throws -> String {
        return try await sendRequest(prompt: "...", model: model, apiKey: apiKey)
    }
    
    public func translate(text: String, from: String, to: String, model: String, apiKey: String) async throws -> String {
        return try await sendRequest(prompt: "...", model: model, apiKey: apiKey)
    }
    
    private func sendRequest(prompt: String, model: String, apiKey: String) async throws -> String {
        let url = URL(string: "https://api.anthropic.com/v1/messages")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "model": model.isEmpty ? defaultModel : model,
            "max_tokens": 4096,
            "messages": [["role": "user", "content": prompt]]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AIError.requestFailed
        }
        
        struct Response: Codable {
            struct Content: Codable { let text: String }
            let content: [Content]
        }
        
        let result = try JSONDecoder().decode(Response.self, from: data)
        return result.content.first?.text ?? ""
    }
}
```

- [ ] **Step 4: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 5: Manual QA**

1. Run app
2. Open Settings → AI Provider
3. Select each provider (OpenAI, Groq, Anthropic, etc.)
4. Verify app doesn't crash when switching

- [ ] **Step 6: Commit**

```bash
git add OpenType/Sources/Providers/AI/*.swift
git commit -m "feat: implement all AI providers with real API calls"
```

---

## Phase 4: Transcription Providers

### Task 4.1: Update TranscriptionProvider Protocol for Model Support

**Files:**
- Modify: `OpenType/Sources/Providers/Transcription/TranscriptionProvider.swift`
- Modify: `OpenType/Sources/Providers/Transcription/OpenAIWhisperProvider.swift`
- Modify: `OpenType/Sources/Providers/Transcription/GroqTranscriptionProvider.swift`
- Modify: `OpenType/Sources/Providers/Transcription/AppleSpeechProvider.swift`

- [ ] **Step 1: Update protocol**

```swift
public protocol TranscriptionProvider: Sendable {
    var name: String { get }
    var supportsStreaming: Bool { get }
    var defaultModel: String { get }
    var availableModels: [String] { get }
    
    func transcribe(audioURL: URL, model: String, language: String?) async throws -> TranscriptionResult
}
```

- [ ] **Step 2: Update existing providers with model property**

OpenAIWhisperProvider: `defaultModel = "whisper-1"`, `availableModels = ["whisper-1"]`

GroqTranscriptionProvider: `defaultModel = "whisper-large-v3"`, `availableModels = ["whisper-large-v3", "whisper-large-v3-turbo", "distil-whisper-large-v3-en"]`

AppleSpeechProvider: `defaultModel = "on-device"`, `availableModels = ["on-device"]`

- [ ] **Step 3: Update TranscriptionService**

```swift
public func transcribe(audioURL: URL, language: String? = nil) async throws -> TranscriptionResult {
    let providerName = SettingsStore.shared.selectedTranscriptionProvider
    let provider = TranscriptionProviderFactory.makeProvider(name: providerName)
    let model = SettingsStore.shared.selectedTranscriptionModel
    return try await provider.transcribe(audioURL: audioURL, model: model, language: language)
}
```

- [ ] **Step 4: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 5: Commit**

```bash
git add OpenType/Sources/Providers/Transcription/*.swift OpenType/Sources/Services/TranscriptionService.swift
git commit -m "feat: add model parameter to transcription providers"
```

---

### Task 4.2: Add Aliyun ASR Provider

**Files:**
- Create: `OpenType/Sources/Providers/Transcription/AliyunSignature.swift`
- Create: `OpenType/Sources/Providers/Transcription/AliyunASRProvider.swift`

- [ ] **Step 1: Create Aliyun signature helper**

Implement ACS3-HMAC-SHA256 signature (full implementation as shown in original plan).

- [ ] **Step 2: Create AliyunASRProvider**

Implement with signature authentication and paraformer models.

- [ ] **Step 3: Update TranscriptionProviderFactory**

Add `case "Aliyun ASR": return AliyunASRProvider()`

- [ ] **Step 4: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

**Expected:** Build succeeds

- [ ] **Step 5: Commit**

```bash
git add OpenType/Sources/Providers/Transcription/Aliyun*.swift
git commit -m "feat: add Aliyun ASR transcription provider"
```

---

## Phase 5: UI/UX Fixes

### Task 5.1: Fix Settings Provider Lists

**Files:**
- Modify: `OpenType/Sources/UI/Windows/Views/SettingsTabViews.swift`

- [ ] **Step 1: Fix transcription providers list**

```swift
// Line 239, replace:
private let providers = ["Apple Speech", "Whisper", "Deepgram", "AssemblyAI"]

// With:
private let transcriptionProviders = ["Apple Speech", "OpenAI Whisper", "Groq", "Aliyun ASR"]
```

- [ ] **Step 2: Fix AI providers list**

```swift
// Line 318, replace:
private let providers = ["OpenAI", "Anthropic", "Google AI"]

// With:
private let aiProviders = ["OpenAI", "Groq", "Anthropic", "DeepSeek", "Zhipu", "MiniMax", "Moonshot"]
```

- [ ] **Step 3: Verify build and UI**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

Run app, open Settings, verify provider lists match implementation.

- [ ] **Step 4: Commit**

```bash
git add OpenType/Sources/UI/Windows/Views/SettingsTabViews.swift
git commit -m "fix: update settings provider lists to match implementation"
```

---

### Task 5.2: Enhance Error Handling

**Files:**
- Modify: `OpenType/Sources/Providers/Transcription/TranscriptionError.swift`
- Modify: `OpenType/Sources/Providers/AI/AIError.swift`

- [ ] **Step 1: Add detailed error cases**

Add `invalidApiKey`, `rateLimited`, `networkError`, `serviceUnavailable` cases with LocalizedError conformance.

- [ ] **Step 2: Verify build**

```bash
cd OpenType && xcodebuild -project OpenType.xcodeproj -scheme OpenType build
```

- [ ] **Step 3: Commit**

```bash
git add OpenType/Sources/Providers/Transcription/TranscriptionError.swift OpenType/Sources/Providers/AI/AIError.swift
git commit -m "feat: enhance error handling with detailed messages"
```

---

## Corrected Dependencies

```
Phase 0:
└── Task 0.1: Add XCTest target (foundation for TDD)

Phase 1 (all independent, can run in parallel after Phase 0):
├── Task 1.1: Fix audio metering
├── Task 1.2: Fix getAvailableProviders()
├── Task 1.3: Remove fatalError
└── Task 2.1: Add model config to SettingsStore

Phase 2 (sequential):
├── Task 2.2: Update AIProvider protocol
│   └── Task 2.3: Create stub AI providers → depends on 2.2
│       └── Task 2.4: Create AIProviderFactory → depends on 2.3
│           └── Task 2.5: Update AIProcessingService → depends on 2.1, 2.4

Phase 3 (can start after 2.3):
└── Task 3.1: Create OpenAICompatibleProvider
    └── Task 3.2: Implement all AI providers → depends on 3.1

Phase 4:
├── Task 4.1: Update TranscriptionProvider protocol
│   └── Task 4.2: Add Aliyun ASR → depends on 4.1

Phase 5 (depends on Phase 3, 4):
├── Task 5.1: Fix settings UI
└── Task 5.2: Enhance error handling
```

---

## Estimated Effort

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 0 | 1 task | 30 min |
| Phase 1 | 4 tasks | 2-3 hours |
| Phase 2 | 5 tasks | 2-3 hours |
| Phase 3 | 2 tasks | 2-3 hours |
| Phase 4 | 2 tasks | 1-2 hours |
| Phase 5 | 2 tasks | 1 hour |
| **Total** | **16 tasks** | **9-13 hours** |

---

## QA Checklist

After all phases complete:

- [ ] Build succeeds: `xcodebuild -project OpenType.xcodeproj -scheme OpenType build`
- [ ] Tests pass: `xcodebuild test -project OpenType.xcodeproj -scheme OpenType -destination 'platform=macOS'`
- [ ] App launches without crash
- [ ] Settings → Transcription Provider shows: Apple Speech, OpenAI Whisper, Groq, Aliyun ASR
- [ ] Settings → AI Provider shows: OpenAI, Groq, Anthropic, DeepSeek, Zhipu, MiniMax, Moonshot
- [ ] Recording audio shows real audio level (not random)
- [ ] HistoryStore doesn't crash on database errors