import Foundation
import Models
import Data

actor OpenAIWhisperProvider: TranscriptionProvider {
    public let name = "OpenAI Whisper"

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        guard let apiKey = KeychainManager.shared.getTranscriptionAPIKey(provider: name) else {
            throw TranscriptionError.providerUnavailable
        }

        let url = URL(string: "https://api.openai.com/v1/audio/transcriptions")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n".data(using: .utf8)!)
        body.append("whisper-1\r\n".data(using: .utf8)!)

        if let language = language {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(language)\r\n".data(using: .utf8)!)
        }

        let audioData = try Data(contentsOf: audioURL)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/wav\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw TranscriptionError.recognitionFailed
        }

        let result = try JSONDecoder().decode(WhisperResponse.self, from: data)

        return TranscriptionResult(
            text: result.text.trimmingCharacters(in: .whitespacesAndNewlines),
            language: result.language ?? language ?? "en",
            confidence: nil,
            segments: nil,
            duration: result.duration ?? 0,
            provider: name
        )
    }
}

private struct WhisperResponse: Codable {
    let text: String
    let language: String?
    let duration: Double?
}
