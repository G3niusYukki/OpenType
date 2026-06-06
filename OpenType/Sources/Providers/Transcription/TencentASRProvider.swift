import CommonCrypto
import Data
import Foundation
import Models

/// Tencent Cloud ASR — Sentence Recognition (一句话识别)
/// Auth: TC3-HMAC-SHA256 signature
/// Docs: https://cloud.tencent.com/document/api/1093/35646
public actor TencentASRProvider: TranscriptionProvider {
    public let name = "Tencent Cloud ASR"
    private let endpoint = "asr.tencentcloudapi.com"
    private let service = "asr"
    private let apiVersion = "2019-06-14"
    private let region = "ap-guangzhou"

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        guard let secretId = KeychainManager.shared.getCredential(provider: name, keyName: "secretId"),
              let secretKey = KeychainManager.shared.getCredential(provider: name, keyName: "secretKey")
        else {
            throw TranscriptionError.providerUnavailable
        }

        let audioData = try Data(contentsOf: audioURL)
        let audioBase64 = audioData.base64EncodedString()

        // Map language code to Tencent's engine model type
        let engineModelType = mapLanguage(language)
        let params: [String: Any] = [
            "ProjectId": 0,
            "SubServiceType": 2,
            "EngSerViceType": engineModelType,
            "SourceType": 1,
            "VoiceFormat": "wav",
            "Data": audioBase64,
            "DataLen": audioData.count,
        ]
        let bodyData = try JSONSerialization.data(withJSONObject: params)
        let bodyString = String(data: bodyData, encoding: .utf8)!

        let request = try buildSignedRequest(
            secretId: secretId,
            secretKey: secretKey,
            action: "SentenceRecognition",
            body: bodyString
        )
        request.httpBody = bodyData

        let (data, response) = try await URLSession.shared.data(for: request as URLRequest)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw TranscriptionError.recognitionFailed
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let resp = json["Response"] as? [String: Any]
        else {
            throw TranscriptionError.recognitionFailed
        }

        if let error = resp["Error"] as? [String: Any] {
            let code = error["Code"] as? String ?? ""
            if code.contains("AuthFailure") || code.contains("InvalidParameter") {
                throw TranscriptionError.invalidCredentials
            }
            throw TranscriptionError.recognitionFailed
        }

        let text = resp["Result"] as? String ?? ""

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

    // MARK: - Language mapping

    private func mapLanguage(_ language: String?) -> String {
        guard let lang = language else { return "16k_zh" }
        switch lang {
        case "zh", "zh-CN", "zh-Hans": return "16k_zh"
        case "en", "en-US": return "16k_en"
        case "yue", "zh-HK": return "16k_yue"
        case "ja", "ja-JP": return "16k_ja"
        case "ko", "ko-KR": return "16k_ko"
        default: return "16k_zh"
        }
    }

    // MARK: - TC3-HMAC-SHA256 signing

    private func buildSignedRequest(
        secretId: String,
        secretKey: String,
        action: String,
        body: String
    ) throws -> NSMutableURLRequest {
        let timestamp = String(Int(Date().timeIntervalSince1970))
        let date = formatDate(Date())
        let httpMethod = "POST"
        let canonicalURI = "/"
        let canonicalQueryString = ""
        let contentType = "application/json"
        let host = endpoint

        // Step 1: Canonical Request
        let canonicalHeaders = "content-type:\(contentType)\nhost:\(host)\n"
        let signedHeaders = "content-type;host"
        let hashedPayload = sha256Hex(body)
        let canonicalRequest = [
            httpMethod,
            canonicalURI,
            canonicalQueryString,
            canonicalHeaders,
            signedHeaders,
            hashedPayload,
        ].joined(separator: "\n")

        // Step 2: String to Sign
        let algorithm = "TC3-HMAC-SHA256"
        let credentialScope = "\(date)/\(service)/tc3_request"
        let hashedCanonicalRequest = sha256Hex(canonicalRequest)
        let stringToSign = [
            algorithm,
            timestamp,
            credentialScope,
            hashedCanonicalRequest,
        ].joined(separator: "\n")

        // Step 3: Signature
        let secretDate = hmacSHA256(key: "TC3\(secretKey)", data: date)
        let secretService = hmacSHA256Data(key: secretDate, data: service)
        let secretSigning = hmacSHA256Data(key: secretService, data: "tc3_request")
        let signature = hmacSHA256HexData(key: secretSigning, data: stringToSign)

        // Step 4: Authorization header
        let authorization = "\(algorithm) Credential=\(secretId)/\(credentialScope), SignedHeaders=\(signedHeaders), Signature=\(signature)"

        let url = URL(string: "https://\(host)")!
        let request = NSMutableURLRequest(url: url)
        request.httpMethod = httpMethod
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue(host, forHTTPHeaderField: "Host")
        request.setValue(timestamp, forHTTPHeaderField: "X-TC-Timestamp")
        request.setValue(apiVersion, forHTTPHeaderField: "X-TC-Version")
        request.setValue(action, forHTTPHeaderField: "X-TC-Action")
        request.setValue(region, forHTTPHeaderField: "X-TC-Region")
        request.setValue(authorization, forHTTPHeaderField: "Authorization")

        return request
    }

    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    // MARK: - Crypto helpers

    private func sha256Hex(_ str: String) -> String {
        guard let data = str.data(using: .utf8) else { return "" }
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes { _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash) }
        return hash.map { String(format: "%02x", $0) }.joined()
    }

    private func hmacSHA256(key: String, data: String) -> Data {
        hmacSHA256Data(key: key.data(using: .utf8)!, data: data)
    }

    private func hmacSHA256Data(key: Data, data: String) -> Data {
        let d = data.data(using: .utf8)!
        var mac = Data(count: Int(CC_SHA256_DIGEST_LENGTH))
        key.withUnsafeBytes { k in
            d.withUnsafeBytes { bytes in
                mac.withUnsafeMutableBytes { m in
                    CCHmac(CCHmacAlgorithm(kCCHmacAlgSHA256),
                           k.baseAddress, key.count,
                           bytes.baseAddress, d.count,
                           m.bindMemory(to: UInt8.self).baseAddress)
                }
            }
        }
        return mac
    }

    private func hmacSHA256HexData(key: Data, data: String) -> String {
        hmacSHA256Data(key: key, data: data).map { String(format: "%02x", $0) }.joined()
    }
}
