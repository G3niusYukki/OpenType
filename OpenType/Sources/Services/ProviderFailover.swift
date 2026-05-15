import Foundation

public struct ProviderFailover {
    private let allProviders = ["OpenAI", "Groq", "Anthropic", "DeepSeek", "Zhipu", "MiniMax", "Moonshot"]
    private let selectedProvider: String

    public init(selectedProvider: String) {
        self.selectedProvider = selectedProvider
    }

    /// Ordered list of providers to try, starting with the user's selected provider.
    public func providerOrder() -> [String] {
        var ordered = [selectedProvider]
        for provider in allProviders where provider != selectedProvider {
            ordered.append(provider)
        }
        return ordered
    }

    /// Return the next provider to try after the given one, or nil if exhausted.
    public func nextProvider(after current: String) -> String? {
        let order = providerOrder()
        guard let index = order.firstIndex(of: current),
              index + 1 < order.count else {
            return nil
        }
        return order[index + 1]
    }
}
