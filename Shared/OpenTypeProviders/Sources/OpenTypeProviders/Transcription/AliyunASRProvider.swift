     1|import Foundation
     2|import OpenTypeModels
     3|import OpenTypeData
     4|import CommonCrypto
     5|
     6|public actor AliyunASRProvider: TranscriptionProvider {
     7|    public let name = "Alibaba Cloud ASR"
     8|    private let endpoint = "https://nls-meta.cn-shanghai.aliyuncs.com"
     9|    private let apiPath = "/rest/2022-12/14/asr"
    10|    private let apiVersion = "2022-12-14"
    11|
    12|    public func transcribe(audioURL: URL, language: String?) async throws -> TranscriptionResult {
    13|        // Get credentials from Keychain
    14|        guard let accessKeyId = KeychainManager.shared.getCredential(provider: name, keyName: "accessKeyId"),
    15|              let accessKeySecret = KeychainManager.shared.getCredential(provider: name, keyName: "accessKeySecret") else {
    16|            throw TranscriptionError.providerUnavailable
    17|        }
    18|
    19|        // Convert audio to base64
    20|        let audioData = try Data(contentsOf: audioURL)
    21|        let audioBase64 = audioData.base64EncodedString()
    22|
    23|        // Create request body — only include language when explicitly specified
    24|        var payload: [String: Any] = [
    25|            "audio_base64": audioBase64,
    26|            "audio_format": "wav",
    27|            "sample_rate": 16000,
    28|            "enable_punctuation_prediction": true,
    29|            "enable_inverse_text_normalization": true
    30|        ]
    31|        if let language = language {
    32|            payload["language"] = language
    33|        }
    34|
    35|        let requestBody: [String: Any] = [
    36|            "payload": payload,
    37|            "context": [
    38|                "device_id": "opentype-macos"
    39|            ]
    40|        ]
    41|
    42|        let bodyData = try JSONSerialization.data(withJSONObject: requestBody)
    43|        let bodyString = String(data: bodyData, encoding: .utf8)!
    44|
    45|        // Headers for signature
    46|        let timestamp = generateTimestamp()
    47|        let nonce = UUID().uuidString
    48|        let contentType = "application/json"
    49|
    50|        // Generate signature using ACS3-HMAC-SHA256
    51|        let signature = generateACS3Signature(
    52|            accessKeyId: accessKeyId,
    53|            accessKeySecret: accessKeySecret,
    54|            method: "POST",
    55|            path: apiPath,
    56|            query: "",
    57|            body: bodyString,
    58|            contentType: contentType,
    59|            timestamp: timestamp,
    60|            nonce: nonce
    61|        )
    62|
    63|        // Build request with required headers
    64|        let url = URL(string: "\(endpoint)\(apiPath)")!
    65|        var request = URLRequest(url: url)
    66|        request.httpMethod = "POST"
    67|        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
    68|        request.setValue(timestamp, forHTTPHeaderField: "x-acs-date")
    69|        request.setValue(nonce, forHTTPHeaderField: "x-acs-signature-nonce")
    70|        request.setValue(apiVersion, forHTTPHeaderField: "x-acs-version")
    71|        request.setValue("ASR", forHTTPHeaderField: "x-acs-action")
    72|        request.setValue("ACS3-HMAC-SHA256", forHTTPHeaderField: "x-acs-algorithm")
    73|        request.setValue("\(accessKeyId)/\(signature)", forHTTPHeaderField: "Authorization")
    74|        request.httpBody = bodyData
    75|
    76|        // Execute request
    77|        let (data, response) = try await URLSession.shared.data(for: request)
    78|
    79|        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
    80|            // Parse error response
    81|            if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
    82|                let errorCode = errorJson["code"] as? String
    83|                
    84|                if errorCode == "InvalidAccessKeyId.NotFound" || errorCode == "SignatureDoesNotMatch" {
    85|                    throw TranscriptionError.invalidCredentials
    86|                } else if errorCode == "QuotaExceeded" {
    87|                    throw TranscriptionError.quotaExceeded
    88|                }
    89|                
    90|                throw TranscriptionError.recognitionFailed
    91|            }
    92|            throw TranscriptionError.recognitionFailed
    93|        }
    94|
    95|        // Parse response
    96|        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    97|        guard let payload = json?["payload"] as? [String: Any],
    98|              let result = payload["result"] as? String else {
    99|            throw TranscriptionError.recognitionFailed
   100|        }
   101|
   102|        // Extract detected language from response when available
   103|        let detectedLangFromResponse = payload["language"] as? String
   104|
   105|        let resolvedLanguage: String?
   106|        let detectedLanguage: String?
   107|        if language == nil {
   108|            let detected = detectedLangFromResponse ?? "zh"
   109|            resolvedLanguage = detected
   110|            detectedLanguage = detected
   111|        } else {
   112|            resolvedLanguage = language
   113|            detectedLanguage = nil
   114|        }
   115|
   116|        return TranscriptionResult(
   117|            text: result.trimmingCharacters(in: .whitespacesAndNewlines),
   118|            language: resolvedLanguage,
   119|            detectedLanguage: detectedLanguage,
   120|            confidence: nil,
   121|            segments: nil,
   122|            duration: 0,
   123|            provider: name
   124|        )
   125|    }
   126|
   127|    // MARK: - Timestamp
   128|
   129|    private func generateTimestamp() -> String {
   130|        let formatter = DateFormatter()
   131|        formatter.locale = Locale(identifier: "en_US_POSIX")
   132|        formatter.timeZone = TimeZone(secondsFromGMT: 0)
   133|        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
   134|        return formatter.string(from: Date())
   135|    }
   136|
   137|    // MARK: - ACS3-HMAC-SHA256 Signature
   138|
   139|    private func generateACS3Signature(
   140|        accessKeyId: String,
   141|        accessKeySecret: String,
   142|        method: String,
   143|        path: String,
   144|        query: String,
   145|        body: String,
   146|        contentType: String,
   147|        timestamp: String,
   148|        nonce: String
   149|    ) -> String {
   150|        // Build canonical request
   151|        let hashedBody = sha256Hex(body)
   152|        let canonicalHeaders = "content-type:\(contentType)\nx-acs-action:ASR\nx-acs-date:\(timestamp)\nx-acs-signature-nonce:\(nonce)\nx-acs-version:\(apiVersion)\n"
   153|        let signedHeaders = "content-type;x-acs-action;x-acs-date;x-acs-signature-nonce;x-acs-version"
   154|        let canonicalRequest = "\(method)\n\(path)\n\(query)\n\(canonicalHeaders)\n\(signedHeaders)\n\(hashedBody)"
   155|
   156|        // String to sign
   157|        let hashedCanonicalRequest = sha256Hex(canonicalRequest)
   158|        let stringToSign = "ACS3-HMAC-SHA256\n\(hashedCanonicalRequest)"
   159|
   160|        // Sign
   161|        let signatureData = hmacSHA256(key: accessKeySecret, data: stringToSign)
   162|        return signatureData.map { String(format: "%02x", $0) }.joined()
   163|    }
   164|
   165|    private func sha256Hex(_ str: String) -> String {
   166|        guard let data = str.data(using: .utf8) else { return "" }
   167|        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
   168|        data.withUnsafeBytes { ptr in
   169|            _ = CC_SHA256(ptr.baseAddress, CC_LONG(data.count), &hash)
   170|        }
   171|        return hash.map { String(format: "%02x", $0) }.joined()
   172|    }
   173|
   174|    private func hmacSHA256(key: String, data: String) -> Data {
   175|        let keyData = key.data(using: .utf8)!
   176|        let dataToSign = data.data(using: .utf8)!
   177|
   178|        var macData = Data(count: Int(CC_SHA256_DIGEST_LENGTH))
   179|
   180|        keyData.withUnsafeBytes { keyBytes in
   181|            dataToSign.withUnsafeBytes { dataBytes in
   182|                macData.withUnsafeMutableBytes { macBytes in
   183|                    CCHmac(CCHmacAlgorithm(kCCHmacAlgSHA256),
   184|                           keyBytes.baseAddress, keyData.count,
   185|                           dataBytes.baseAddress, dataToSign.count,
   186|                           macBytes.bindMemory(to: UInt8.self).baseAddress)
   187|                }
   188|            }
   189|        }
   190|
   191|        return macData
   192|    }
   193|}
   194|