import Foundation
import Models
import Data

public actor OpenAIWhisperProvider: TranscriptionProvider, ProviderHTTPClient {
    public let name = "OpenAI Whisper"

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        guard let apiKey = KeychainManager.shared.getTranscriptionAPIKey(provider: name) else {
            throw TranscriptionError.providerUnavailable
        }

        let audioData = try Data(contentsOf: audioURL)
        var fields: [String: String] = ["model": "whisper-1"]
        if let language {
            fields["language"] = language
        }

        let response: WhisperResponse = try await performMultipartUpload(
            url: URL(string: "https://api.openai.com/v1/audio/transcriptions")!,
            fields: fields,
            file: (fieldName: "file", fileName: "audio.wav", mimeType: "audio/wav", data: audioData),
            apiKey: apiKey
        )

        let resolvedLanguage: String?
        let detectedLanguage: String?
        if language == nil {
            let detected = response.language ?? "en"
            resolvedLanguage = detected
            detectedLanguage = detected
        } else {
            resolvedLanguage = language
            detectedLanguage = nil
        }

        return TranscriptionResult(
            text: response.text.trimmingCharacters(in: .whitespacesAndNewlines),
            language: resolvedLanguage,
            detectedLanguage: detectedLanguage,
            confidence: nil,
            segments: nil,
            duration: response.duration ?? 0,
            provider: name
        )
    }
}

private struct WhisperResponse: Decodable {
    let text: String
    let language: String?
    let duration: Double?
}
