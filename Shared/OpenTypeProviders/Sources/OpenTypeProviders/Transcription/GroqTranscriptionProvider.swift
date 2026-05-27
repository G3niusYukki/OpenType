     1|import Foundation
     2|import OpenTypeModels
     3|import OpenTypeData
     4|
     5|actor GroqTranscriptionProvider: TranscriptionProvider {
     6|    public let name = "Groq"
     7|
     8|    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
     9|        guard let apiKey = KeychainManager.shared.getTranscriptionAPIKey(provider: name) else {
    10|            throw TranscriptionError.providerUnavailable
    11|        }
    12|
    13|        let url = URL(string: "https://api.groq.com/v1/audio/transcriptions")!
    14|
    15|        var request = URLRequest(url: url)
    16|        request.httpMethod = "POST"
    17|        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    18|
    19|        let boundary = UUID().uuidString
    20|        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
    21|
    22|        // Model selection: multilingual for non-English or auto-detect, English-only for en
    23|        let model: String
    24|        if language == nil || language != "en" {
    25|            model = "whisper-large-v3"
    26|        } else {
    27|            model = "distil-whisper-large-v3-en"
    28|        }
    29|
    30|        var body = Data()
    31|        body.append("--\(boundary)\r\n".data(using: .utf8)!)
    32|        body.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n".data(using: .utf8)!)
    33|        body.append("\(model)\r\n".data(using: .utf8)!)
    34|
    35|        // Only include language field when explicitly provided
    36|        if let language = language {
    37|            body.append("--\(boundary)\r\n".data(using: .utf8)!)
    38|            body.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n".data(using: .utf8)!)
    39|            body.append("\(language)\r\n".data(using: .utf8)!)
    40|        }
    41|
    42|        let audioData = try Data(contentsOf: audioURL)
    43|        body.append("--\(boundary)\r\n".data(using: .utf8)!)
    44|        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n".data(using: .utf8)!)
    45|        body.append("Content-Type: audio/wav\r\n\r\n".data(using: .utf8)!)
    46|        body.append(audioData)
    47|        body.append("\r\n".data(using: .utf8)!)
    48|        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
    49|
    50|        request.httpBody = body
    51|
    52|        let (data, response) = try await URLSession.shared.data(for: request)
    53|
    54|        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
    55|            throw TranscriptionError.recognitionFailed
    56|        }
    57|
    58|        let result = try JSONDecoder().decode(WhisperResponse.self, from: data)
    59|
    60|        // When auto-detect (language is nil), populate detectedLanguage from API response
    61|        let resolvedLanguage: String?
    62|        let detectedLanguage: String?
    63|        if language == nil {
    64|            let detected = result.language ?? "en"
    65|            resolvedLanguage = detected
    66|            detectedLanguage = detected
    67|        } else {
    68|            resolvedLanguage = language
    69|            detectedLanguage = nil
    70|        }
    71|
    72|        return TranscriptionResult(
    73|            text: result.text.trimmingCharacters(in: .whitespacesAndNewlines),
    74|            language: resolvedLanguage,
    75|            detectedLanguage: detectedLanguage,
    76|            confidence: nil,
    77|            segments: nil,
    78|            duration: result.duration ?? 0,
    79|            provider: name
    80|        )
    81|    }
    82|}
    83|
    84|private struct WhisperResponse: Codable {
    85|    let text: String
    86|    let language: String?
    87|    let duration: Double?
    88|}
    89|