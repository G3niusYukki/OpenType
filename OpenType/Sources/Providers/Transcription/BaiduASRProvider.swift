import Data
import Foundation
import Models

/// Baidu Cloud ASR — Short Speech Recognition (短语音识别)
/// Auth: OAuth2 Bearer Token (API Key + Secret Key → access_token)
/// Docs: https://ai.baidu.com/ai-doc/SPEECH/Vk38lxily
public actor BaiduASRProvider: TranscriptionProvider {
    public let name = "Baidu Cloud ASR"
    private let tokenURL = "https://aip.baidubce.com/oauth/2.0/token"
    private let asrURL = "https://vop.baidu.com/server_api"

    // Cache the token to avoid fetching for every request
    private var cachedToken: String?
    private var tokenExpiry: Date?

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        guard let apiKey = KeychainManager.shared.getCredential(provider: name, keyName: "apiKey"),
              let secretKey = KeychainManager.shared.getCredential(provider: name, keyName: "secretKey")
        else {
            throw TranscriptionError.providerUnavailable
        }

        let token = try await getAccessToken(apiKey: apiKey, secretKey: secretKey)
        let audioData = try Data(contentsOf: audioURL)
        let audioBase64 = audioData.base64EncodedString()

        // Build JSON request body
        var params: [String: Any] = [
            "format": "wav",
            "rate": 16000,
            "channel": 1,
            "cuid": "opentype-macos",
            "token": token,
            "speech": audioBase64,
            "len": audioData.count,
        ]

        if let lang = language {
            params["dev_pid"] = mapLanguage(lang)
        } else {
            params["dev_pid"] = 1537 // 普通话(纯中文识别)
        }

        let bodyData = try JSONSerialization.data(withJSONObject: params)

        let url = URL(string: asrURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = bodyData

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw TranscriptionError.recognitionFailed
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw TranscriptionError.recognitionFailed
        }

        // Check for errors
        if let errNo = json["err_no"] as? Int, errNo != 0 {
            let errMsg = json["err_msg"] as? String ?? "Unknown error"
            if errNo == 3301 || errNo == 3302 {
                throw TranscriptionError.invalidCredentials
            }
            print("[BaiduASR] Error \(errNo): \(errMsg)")
            throw TranscriptionError.recognitionFailed
        }

        let text = (json["result"] as? [String])?.joined(separator: "") ?? ""

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
            text: text.trimmingCharacters(in: .whitespacesAndNewlines),
            language: resolvedLanguage,
            detectedLanguage: detectedLanguage,
            confidence: nil,
            segments: nil,
            duration: 0,
            provider: name
        )
    }

    // MARK: - OAuth2 token

    private func getAccessToken(apiKey: String, secretKey: String) async throws -> String {
        // Return cached token if still valid (tokens last ~30 days, but refresh early)
        if let cached = cachedToken, let expiry = tokenExpiry, expiry > Date() {
            return cached
        }

        var components = URLComponents(string: tokenURL)!
        components.queryItems = [
            URLQueryItem(name: "grant_type", value: "client_credentials"),
            URLQueryItem(name: "client_id", value: apiKey),
            URLQueryItem(name: "client_secret", value: secretKey),
        ]

        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw TranscriptionError.invalidCredentials
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = json["access_token"] as? String
        else {
            throw TranscriptionError.invalidCredentials
        }

        let expiresIn = json["expires_in"] as? Double ?? 2_592_000 // default 30 days
        cachedToken = token
        tokenExpiry = Date().addingTimeInterval(expiresIn - 3600) // refresh 1h early
        return token
    }

    // MARK: - Language mapping

    /// Baidu dev_pid values:
    /// 1537 — 普通话(纯中文)
    /// 1737 — 英语
    /// 1637 — 粤语
    /// 1837 — 四川话
    /// 1936 — 普通话远场
    private func mapLanguage(_ language: String) -> Int {
        switch language {
        case "zh", "zh-CN", "zh-Hans": return 1537
        case "en", "en-US": return 1737
        case "yue", "zh-HK": return 1637
        default: return 1537
        }
    }
}
