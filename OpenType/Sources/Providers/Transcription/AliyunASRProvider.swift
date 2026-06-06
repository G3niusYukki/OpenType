import CommonCrypto
import Data
import Foundation
import Models

public actor AliyunASRProvider: TranscriptionProvider {
    public let name = "Alibaba Cloud ASR"
    private let endpoint = "https://nls-meta.cn-shanghai.aliyuncs.com"
    private let apiPath = "/rest/2022-12/14/asr"
    private let apiVersion = "2022-12-14"

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        // Get credentials from Keychain
        guard let accessKeyId = KeychainManager.shared.getCredential(provider: name, keyName: "accessKeyId"),
              let accessKeySecret = KeychainManager.shared.getCredential(provider: name, keyName: "accessKeySecret")
        else {
            throw TranscriptionError.providerUnavailable
        }

        // Convert audio to base64
        let audioData = try Data(contentsOf: audioURL)
        let audioBase64 = audioData.base64EncodedString()

        // Create request body — only include language when explicitly specified
        var payload: [String: Any] = [
            "audio_base64": audioBase64,
            "audio_format": "wav",
            "sample_rate": 16000,
            "enable_punctuation_prediction": true,
            "enable_inverse_text_normalization": true,
        ]
        if let language = language {
            payload["language"] = language
        }

        let requestBody: [String: Any] = [
            "payload": payload,
            "context": [
                "device_id": "opentype-macos",
            ],
        ]

        let bodyData = try JSONSerialization.data(withJSONObject: requestBody)
        let bodyString = String(data: bodyData, encoding: .utf8)!

        // Headers for signature
        let timestamp = generateTimestamp()
        let nonce = UUID().uuidString
        let contentType = "application/json"

        // Generate signature using ACS3-HMAC-SHA256
        let signature = generateACS3Signature(
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
            method: "POST",
            path: apiPath,
            query: "",
            body: bodyString,
            contentType: contentType,
            timestamp: timestamp,
            nonce: nonce
        )

        // Build request with required headers
        let url = URL(string: "\(endpoint)\(apiPath)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue(timestamp, forHTTPHeaderField: "x-acs-date")
        request.setValue(nonce, forHTTPHeaderField: "x-acs-signature-nonce")
        request.setValue(apiVersion, forHTTPHeaderField: "x-acs-version")
        request.setValue("ASR", forHTTPHeaderField: "x-acs-action")
        request.setValue("ACS3-HMAC-SHA256", forHTTPHeaderField: "x-acs-algorithm")
        request.setValue("\(accessKeyId)/\(signature)", forHTTPHeaderField: "Authorization")
        request.httpBody = bodyData

        // Execute request
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            // Parse error response
            if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let errorCode = errorJson["code"] as? String

                if errorCode == "InvalidAccessKeyId.NotFound" || errorCode == "SignatureDoesNotMatch" {
                    throw TranscriptionError.invalidCredentials
                } else if errorCode == "QuotaExceeded" {
                    throw TranscriptionError.quotaExceeded
                }

                throw TranscriptionError.recognitionFailed
            }
            throw TranscriptionError.recognitionFailed
        }

        // Parse response
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let payload = json?["payload"] as? [String: Any],
              let result = payload["result"] as? String
        else {
            throw TranscriptionError.recognitionFailed
        }

        // Extract detected language from response when available
        let detectedLangFromResponse = payload["language"] as? String

        let resolvedLanguage: String?
        let detectedLanguage: String?
        if language == nil {
            let detected = detectedLangFromResponse ?? "zh"
            resolvedLanguage = detected
            detectedLanguage = detected
        } else {
            resolvedLanguage = language
            detectedLanguage = nil
        }

        return TranscriptionResult(
            text: result.trimmingCharacters(in: .whitespacesAndNewlines),
            language: resolvedLanguage,
            detectedLanguage: detectedLanguage,
            confidence: nil,
            segments: nil,
            duration: 0,
            provider: name
        )
    }

    // MARK: - Timestamp

    private func generateTimestamp() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
        return formatter.string(from: Date())
    }

    // MARK: - ACS3-HMAC-SHA256 Signature

    private func generateACS3Signature(
        accessKeyId _: String,
        accessKeySecret: String,
        method: String,
        path: String,
        query: String,
        body: String,
        contentType: String,
        timestamp: String,
        nonce: String
    ) -> String {
        // Build canonical request
        let hashedBody = sha256Hex(body)
        let canonicalHeaders = "content-type:\(contentType)\nx-acs-action:ASR\nx-acs-date:\(timestamp)\nx-acs-signature-nonce:\(nonce)\nx-acs-version:\(apiVersion)\n"
        let signedHeaders = "content-type;x-acs-action;x-acs-date;x-acs-signature-nonce;x-acs-version"
        let canonicalRequest = "\(method)\n\(path)\n\(query)\n\(canonicalHeaders)\n\(signedHeaders)\n\(hashedBody)"

        // String to sign
        let hashedCanonicalRequest = sha256Hex(canonicalRequest)
        let stringToSign = "ACS3-HMAC-SHA256\n\(hashedCanonicalRequest)"

        // Sign
        let signatureData = hmacSHA256(key: accessKeySecret, data: stringToSign)
        return signatureData.map { String(format: "%02x", $0) }.joined()
    }

    private func sha256Hex(_ str: String) -> String {
        guard let data = str.data(using: .utf8) else { return "" }
        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes { ptr in
            _ = CC_SHA256(ptr.baseAddress, CC_LONG(data.count), &hash)
        }
        return hash.map { String(format: "%02x", $0) }.joined()
    }

    private func hmacSHA256(key: String, data: String) -> Data {
        let keyData = key.data(using: .utf8)!
        let dataToSign = data.data(using: .utf8)!

        var macData = Data(count: Int(CC_SHA256_DIGEST_LENGTH))

        keyData.withUnsafeBytes { keyBytes in
            dataToSign.withUnsafeBytes { dataBytes in
                macData.withUnsafeMutableBytes { macBytes in
                    CCHmac(CCHmacAlgorithm(kCCHmacAlgSHA256),
                           keyBytes.baseAddress, keyData.count,
                           dataBytes.baseAddress, dataToSign.count,
                           macBytes.bindMemory(to: UInt8.self).baseAddress)
                }
            }
        }

        return macData
    }
}
