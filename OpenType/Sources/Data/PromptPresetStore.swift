import Foundation
import Models

public enum PromptPresetStoreError: Error, Equatable {
    case cannotModifyBuiltIn
    case customPresetNotFound
}

public final class PromptPresetStore {
    public static let shared = PromptPresetStore()

    private let defaults: UserDefaults
    private let storageKey = "prompt_presets_custom_v1"

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func getAllPresets() -> [PromptPreset] {
        (PromptPreset.builtIns + getCustomPresets()).sorted { lhs, rhs in
            if lhs.sortOrder == rhs.sortOrder {
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
            return lhs.sortOrder < rhs.sortOrder
        }
    }

    public func getCustomPresets() -> [PromptPreset] {
        guard let data = defaults.data(forKey: storageKey),
              let presets = try? JSONDecoder().decode([PromptPreset].self, from: data) else {
            return []
        }
        return presets
            .filter { !$0.isBuiltIn }
            .sorted { lhs, rhs in
                if lhs.sortOrder == rhs.sortOrder {
                    return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
                }
                return lhs.sortOrder < rhs.sortOrder
            }
    }

    public func addCustomPreset(name: String, icon: String, instruction: String) -> PromptPreset {
        var presets = getCustomPresets()
        let nextSortOrder = ((PromptPreset.builtIns + presets).map(\.sortOrder).max() ?? -1) + 1
        let preset = PromptPreset(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            icon: icon.trimmingCharacters(in: .whitespacesAndNewlines),
            instruction: instruction.trimmingCharacters(in: .whitespacesAndNewlines),
            isBuiltIn: false,
            sortOrder: nextSortOrder
        )
        presets.append(preset)
        saveCustomPresets(presets)
        return preset
    }

    public func updateCustomPreset(_ preset: PromptPreset) throws {
        guard !preset.isBuiltIn, !PromptPreset.builtIns.contains(where: { $0.id == preset.id }) else {
            throw PromptPresetStoreError.cannotModifyBuiltIn
        }

        var presets = getCustomPresets()
        guard let index = presets.firstIndex(where: { $0.id == preset.id }) else {
            throw PromptPresetStoreError.customPresetNotFound
        }

        var updated = preset
        updated.isBuiltIn = false
        presets[index] = updated
        saveCustomPresets(presets)
    }

    public func deleteCustomPreset(id: UUID) throws {
        guard !PromptPreset.builtIns.contains(where: { $0.id == id }) else {
            throw PromptPresetStoreError.cannotModifyBuiltIn
        }

        var presets = getCustomPresets()
        let originalCount = presets.count
        presets.removeAll { $0.id == id }
        guard presets.count != originalCount else {
            throw PromptPresetStoreError.customPresetNotFound
        }
        saveCustomPresets(presets)
    }

    private func saveCustomPresets(_ presets: [PromptPreset]) {
        let customs = presets.filter { !$0.isBuiltIn }
        guard let data = try? JSONEncoder().encode(customs) else { return }
        defaults.set(data, forKey: storageKey)
    }
}
