import Combine
import Foundation

/// A property wrapper that reads/writes to UserDefaults, publishing changes via ObservableObject.
/// Eliminates the repetitive `didSet { defaults.set(value, forKey: key) }` pattern in SettingsStore.
@propertyWrapper
public struct UserDefault<T> {
    public let key: String
    public let defaultValue: T
    private let defaults: UserDefaults

    public init(wrappedValue: T, _ key: String, defaults: UserDefaults = .standard) {
        self.key = key
        defaultValue = wrappedValue
        self.defaults = defaults
    }

    public static subscript<Enclosing: ObservableObject>(
        _enclosingInstance instance: Enclosing,
        wrapped _: ReferenceWritableKeyPath<Enclosing, T>,
        storage storageKeyPath: ReferenceWritableKeyPath<Enclosing, Self>
    ) -> T {
        get {
            let wrapper = instance[keyPath: storageKeyPath]
            return (wrapper.defaults.object(forKey: wrapper.key) as? T) ?? wrapper.defaultValue
        }
        set {
            let wrapper = instance[keyPath: storageKeyPath]
            wrapper.defaults.set(newValue, forKey: wrapper.key)
            // Trigger ObservableObject change
            (instance.objectWillChange as? ObservableObjectPublisher)?.send()
        }
    }

    @available(*, unavailable, message: "@UserDefault can only be used on class properties")
    public var wrappedValue: T {
        get { fatalError() }
        set { fatalError() }
    }
}

public extension UserDefault where T: ExpressibleByNilLiteral {
    init(_ key: String, defaults: UserDefaults = .standard) {
        self.init(wrappedValue: nil, key, defaults: defaults)
    }
}
