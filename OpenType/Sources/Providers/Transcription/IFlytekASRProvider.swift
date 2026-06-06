import CommonCrypto
import Data
import Foundation
import Models

/// iFlytek (科大讯飞) ASR — Streaming Speech Recognition via WebSocket
/// Auth: HMAC-SHA256 signed URL
/// Docs: https://www.xfyun.cn/doc/asr/voicedictation/API.html
public actor IFlytekASRProvider: TranscriptionProvider {
    public let name = "iFlytek ASR"
    public nonisolated var supportsStreaming: Bool {
        true
    }

    private let hostURL = "ws://iat-api.xfyun.cn/v2/iat"
    private let host = "iat-api.xfyun.cn"

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        guard let appId = KeychainManager.shared.getCredential(provider: name, keyName: "appId"),
              let apiKey = KeychainManager.shared.getCredential(provider: name, keyName: "apiKey"),
              let apiSecret = KeychainManager.shared.getCredential(provider: name, keyName: "apiSecret")
        else {
            throw TranscriptionError.providerUnavailable
        }

        let audioData = try Data(contentsOf: audioURL)

        // Assemble signed WebSocket URL
        let url = try assembleURL(apiKey: apiKey, apiSecret: apiSecret)

        // Use URLSessionWebSocketTask
        let session = URLSession(configuration: .default)
        let wsTask = session.webSocketTask(with: url)
        wsTask.resume()

        defer { wsTask.cancel(with: .normalClosure, reason: nil) }

        // Build handshake frame
        let handshakeParams = buildHandshakeParams(appId: appId, apiKey: apiKey)
        let handshakeData = try JSONSerialization.data(withJSONObject: handshakeParams)
        try await wsTask.send(.data(handshakeData))

        // Send audio data in chunks (1280 bytes per frame as recommended)
        let chunkSize = 1280
        var offset = 0
        while offset < audioData.count {
            let end = min(offset + chunkSize, audioData.count)
            let chunk = audioData[offset ..< end]

            let frame: [String: Any] = [
                "common": ["app_id": appId],
                "business": [
                    "language": mapLanguage(language),
                    "domain": "iat",
                    "accent": "mandarin",
                    "vad_eos": 3000,
                ],
                "data": [
                    "status": offset + chunkSize >= audioData.count ? 2 : 1,
                    "format": "audio/L16;rate=16000",
                    "encoding": "raw",
                    "audio": chunk.base64EncodedString(),
                ],
            ]
            let frameData = try JSONSerialization.data(withJSONObject: frame)
            try await wsTask.send(.data(frameData))

            offset = end
        }

        // Collect results
        var fullText = ""
        var receivedFinal = false

        while !receivedFinal {
            let message = try await wsTask.receive()
            switch message {
            case let .data(data):
                guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let code = json["code"] as? Int else { continue }

                if code != 0 {
                    let msg = json["message"] as? String ?? "Unknown error"
                    print("[iFlytek] Error \(code): \(msg)")
                    throw TranscriptionError.recognitionFailed
                }

                if let d = json["data"] as? [String: Any],
                   let result = d["result"] as? [String: Any]
                {
                    // Accumulate text
                    if let ws = result["ws"] as? [[String: Any]] {
                        for word in ws {
                            if let cw = word["cw"] as? [[String: Any]] {
                                for c in cw {
                                    if let w = c["w"] as? String {
                                        fullText += w
                                    }
                                }
                            }
                        }
                    }

                    // Check status
                    if let status = d["status"] as? Int, status == 2 {
                        receivedFinal = true
                    }
                }
            case let .string(text):
                guard let d = text.data(using: .utf8),
                      let json = try JSONSerialization.jsonObject(with: d) as? [String: Any],
                      let code = json["code"] as? Int else { continue }
                if code != 0 {
                    throw TranscriptionError.recognitionFailed
                }
            @unknown default:
                continue
            }
        }

        let resolvedLanguage: String?
        let detectedLanguage: String?
        if language == nil {
            resolvedLanguage = "zh"
            detectedLanguage = "zh"
        } else {
            resolvedLanguage = language
            detectedLanguage = nil
        }

        return TranscriptionResult(
            text: fullText.trimmingCharacters(in: .whitespacesAndNewlines),
            language: resolvedLanguage,
            detectedLanguage: detectedLanguage,
            confidence: nil,
            segments: nil,
            duration: 0,
            provider: name
        )
    }

    // MARK: - URL assembly with HMAC-SHA256

    private func assembleURL(apiKey: String, apiSecret: String) throws -> URL {
        let date = formatRFC1123(Date())
        let signatureOrigin = "host: \(host)\ndate: \(date)\nGET /v2/iat HTTP/1.1"

        let signatureData = hmacSHA256(key: apiSecret, data: signatureOrigin)
        let signature = signatureData.base64EncodedString()

        let authorizationOrigin = "api_key=\"\(apiKey)\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"\(signature)\""
        let authorization = authorizationOrigin.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? authorizationOrigin

        let urlString = "\(hostURL)?host=\(host)&date=\(date.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? date)&authorization=\(authorization)"
        return URL(string: urlString)!
    }

    // MARK: - Helpers

    private func buildHandshakeParams(appId: String, apiKey _: String) -> [String: Any] {
        return [
            "common": ["app_id": appId],
            "business": [
                "language": "zh_cn",
                "domain": "iat",
                "accent": "mandarin",
                "vad_eos": 3000,
                "dwa": "wpgs",
            ],
            "data": [
                "status": 0,
                "format": "audio/L16;rate=16000",
                "encoding": "raw",
                "audio": "",
            ],
        ]
    }

    private func mapLanguage(_ language: String?) -> String {
        guard let lang = language else { return "zh_cn" }
        switch lang {
        case "zh", "zh-CN": return "zh_cn"
        case "en", "en-US": return "en_us"
        case "yue": return "zh_cn" // iFlytek uses accent param for Cantonese
        case "ja": return "ja_jp"
        case "ko": return "ko_kr"
        default: return "zh_cn"
        }
    }

    private func formatRFC1123(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "EEE, dd MMM yyyy HH:mm:ss 'GMT'"
        return f.string(from: date)
    }

    private func hmacSHA256(key: String, data: String) -> Data {
        let keyData = key.data(using: .utf8)!
        let msgData = data.data(using: .utf8)!
        var mac = Data(count: Int(CC_SHA256_DIGEST_LENGTH))
        keyData.withUnsafeBytes { k in
            msgData.withUnsafeBytes { m in
                mac.withUnsafeMutableBytes { out in
                    CCHmac(CCHmacAlgorithm(kCCHmacAlgSHA256),
                           k.baseAddress, keyData.count,
                           m.baseAddress, msgData.count,
                           out.bindMemory(to: UInt8.self).baseAddress)
                }
            }
        }
        return mac
    }
}
