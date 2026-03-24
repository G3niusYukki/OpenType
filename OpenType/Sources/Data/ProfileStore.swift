import Foundation
import Models
import Utilities

public class ProfileStore: @unchecked Sendable {
    public static let shared = ProfileStore()

    private let defaults: UserDefaults
    private let profilesKey = "profiles"

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func createProfile(name: String, transcriptionProvider: String, aiProvider: String) {
        var profiles = getAllProfiles()
        let newProfile = Profile(
            name: name,
            transcriptionProvider: transcriptionProvider,
            aiProvider: aiProvider,
            isDefault: profiles.isEmpty
        )
        profiles.append(newProfile)
        saveProfiles(profiles)
    }

    public func getAllProfiles() -> [Profile] {
        guard let data = defaults.data(forKey: profilesKey),
              let profiles = try? JSONDecoder().decode([Profile].self, from: data) else {
            return []
        }
        return profiles
    }

    public func deleteProfile(id: UUID) {
        var profiles = getAllProfiles()
        profiles.removeAll { $0.id == id }
        saveProfiles(profiles)
    }

    public func setDefaultProfile(id: UUID) {
        var profiles = getAllProfiles()
        profiles = profiles.map { profile in
            Profile(
                id: profile.id,
                name: profile.name,
                transcriptionProvider: profile.transcriptionProvider,
                aiProvider: profile.aiProvider,
                isDefault: profile.id == id
            )
        }
        saveProfiles(profiles)
    }

    public func getDefaultProfile() -> Profile? {
        getAllProfiles().first { $0.isDefault }
    }

    private func saveProfiles(_ profiles: [Profile]) {
        guard let data = try? JSONEncoder().encode(profiles) else { return }
        defaults.set(data, forKey: profilesKey)
    }
}
