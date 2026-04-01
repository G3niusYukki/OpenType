import Foundation
import Models
import Data
import CommonCrypto

public actor AliyunASRProvider: TranscriptionProvider {
    public let name = "Alibaba Cloud ASR"
    private let endpoint = "https://nls-meta.cn-shanghai.aliyuncs.com"
    private let apiPath = "/rest/2022-12/14/asr"

    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
        // Get credentials from Keychain
        guard let accessKeyId = KeychainManager.shared.getCredential(provider: name, keyName: "accessKeyId"),
              let accessKeySecret = KeychainManager.shared.getCredential(provider: name, keyName: "accessKeySecret") else {
            throw TranscriptionError.providerUnavailable
        }

        // Convert audio to base64
        let audioData = try Data(contentsOf: audioURL)
        let audioBase64 = audioData.base64EncodedString()

        // Create request body
        let requestBody: [String: Any] = [
            "payload": [
                "audio_base64": audioBase64,
                "audio_format": "wav",
                "sample_rate": 16000,
                "enable_punctuation_prediction": true,
                "enable_inverse_text_normalization": true
            ],
            "context": [
                "device_id": "opentype-macos"
            ]
        ]

        // Generate signature
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let signature = generateSignature(
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
            method: "POST",
            path: apiPath,
            body: requestBody,
            timestamp: timestamp
        )

        // Build request
        let url = URL(string: "\(endpoint)\(apiPath)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("acs \(accessKeyId):\(signature)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)

        // Execute request
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            // Parse error response
            if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let errorCode = errorJson["code"] as? String
                let errorMessage = errorJson["message"] as? String ?? "Unknown error"
                
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
              let result = payload["result"] as? String else {
            throw TranscriptionError.recognitionFailed
        }

        return TranscriptionResult(
            text: result.trimmingCharacters(in: .whitespacesAndNewlines),
            language: language ?? "zh",
            confidence: nil,
            segments: nil,
            duration: 0,
            provider: name
        )
    }

    private func generateSignature(
        accessKeyId: String,
        accessKeySecret: String,
        method: String,
        path: String,
        body: [String: Any],
        timestamp: String
    ) -> String {
        // Create canonical request
        let bodyData = try! JSONSerialization.data(withJSONObject: body)
        let bodyString = String(data: bodyData, encoding: .utf8)!
        let canonicalRequest = "\(method)\n\(path)\n\n\(bodyString)"

        // Create string to sign
        let date = timestamp
        let stringToSign = "ACS3-HMAC-SHA256\n\(date)\n\(canonicalRequest)"

        // Generate HMAC-SHA256 signature
        let signature = hmacSHA256(key: accessKeySecret, data: stringToSign)
        return signature.base64EncodedString()
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
