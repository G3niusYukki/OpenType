import Foundation
import Data
import Models

public class ProfileService {
    public static let shared = ProfileService()

    private init() {}

    /// 激活指定 Profile：更新 SettingsStore 的 provider 设置
    public func activate(profile: Profile) {
        SettingsStore.shared.selectedTranscriptionProvider = profile.transcriptionProvider
        SettingsStore.shared.selectedAIProvider = profile.aiProvider
        SettingsStore.shared.lastProfileID = profile.id.uuidString
    }

    /// 获取当前激活的 Profile（如果有）
    public func getActiveProfile() -> Profile? {
        guard let idString = SettingsStore.shared.lastProfileID,
              let id = UUID(uuidString: idString) else { return nil }
        // 从 ProfileStore 查找
        return ProfileStore.shared.getAllProfiles().first { $0.id == id }
    }
}
