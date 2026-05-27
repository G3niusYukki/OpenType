     1|import Foundation
     2|import OpenTypeModels
     3|import OpenTypeData
     4|
     5|actor OpenAIWhisperProvider: TranscriptionProvider {
     6|    public let name = "OpenAI Whisper"
     7|
     8|    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
     9|        guard let apiKey = KeychainManager.shared.getTranscriptionAPIKey(provider: name) else {
    10|            throw TranscriptionError.providerUnavailable
    11|        }
    12|
    13|        let url = URL(string: "https://api.openai.com/v1/audio/transcriptions")!
    14|
    15|        var request = URLRequest(url: url)
    16|        request.httpMethod = "POST"
    17|        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    18|
    19|        let boundary = UUID().uuidString
    20|        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
    21|
    22|        var body = Data()
    23|        body.append("--\(boundary)\r\n".data(using: .utf8)!)
    24|        body.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n".data(using: .utf8)!)
    25|        body.append("whisper-1\r\n".data(using: .utf8)!)
    26|
    27|        // Only include language field when explicitly provided (auto-detect omits it)
    28|        if let language = language {
    29|            body.append("--\(boundary)\r\n".data(using: .utf8)!)
    30|            body.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n".data(using: .utf8)!)
    31|            body.append("\(language)\r\n".data(using: .utf8)!)
    32|        }
    33|
    34|        let audioData = try Data(contentsOf: audioURL)
    35|        body.append("--\(boundary)\r\n".data(using: .utf8)!)
    36|        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n".data(using: .utf8)!)
    37|        body.append("Content-Type: audio/wav\r\n\r\n".data(using: .utf8)!)
    38|        body.append(audioData)
    39|        body.append("\r\n".data(using: .utf8)!)
    40|        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
    41|
    42|        request.httpBody = body
    43|
    44|        let (data, response) = try await URLSession.shared.data(for: request)
    45|
    46|        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
    47|            throw TranscriptionError.recognitionFailed
    48|        }
    49|
    50|        let result = try JSONDecoder().decode(WhisperResponse.self, from: data)
    51|
    52|        // When auto-detect (language is nil), populate detectedLanguage from API response
    53|        let resolvedLanguage: String?
    54|        let detectedLanguage: String?
    55|        if language == nil {
    56|            let detected = result.language ?? "en"
    57|            resolvedLanguage = detected
    58|            detectedLanguage = detected
    59|        } else {
    60|            resolvedLanguage = language
    61|            detectedLanguage = nil
    62|        }
    63|
    64|        return TranscriptionResult(
    65|            text: result.text.trimmingCharacters(in: .whitespacesAndNewlines),
    66|            language: resolvedLanguage,
    67|            detectedLanguage: detectedLanguage,
    68|            confidence: nil,
    69|            segments: nil,
    70|            duration: result.duration ?? 0,
    71|            provider: name
    72|        )
    73|    }
    74|}
    75|
    76|private struct WhisperResponse: Codable {
    77|    let text: String
    78|    let language: String?
    79|    let duration: Double?
    80|}
    81|