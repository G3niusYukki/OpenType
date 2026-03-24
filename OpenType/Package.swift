// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenType",
    platforms: [.macOS(.v13)],
    products: [
        .executable(
            name: "OpenType",
            targets: ["App"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/stephencelis/SQLite.swift", from: "0.15.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.0"),
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.2.0"),
    ],
    targets: [
        .executableTarget(
            name: "App",
            dependencies: [
                "Services",
                "Providers",
                "Models",
                "Data",
                "Utilities",
                "OpenTypeUI",
                .product(name: "SQLite", package: "SQLite.swift"),
                .product(name: "KeychainAccess", package: "KeychainAccess"),
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            path: "Sources/App"
        ),
        .target(name: "Services", dependencies: ["Models", "Providers", "Utilities"], path: "Sources/Services"),
        .target(name: "Providers", dependencies: ["Models", "Utilities"], path: "Sources/Providers"),
        .target(name: "Models", path: "Sources/Models"),
        .target(
            name: "Data",
            dependencies: [
                "Models",
                "Utilities",
                .product(name: "SQLite", package: "SQLite.swift"),
                .product(name: "KeychainAccess", package: "KeychainAccess")
            ],
            path: "Sources/Data"
        ),
        .target(name: "Utilities", path: "Sources/Utilities"),
        .target(name: "OpenTypeUI", dependencies: ["Utilities", "Models", "Data"], path: "Sources/UI"),
        .testTarget(name: "AppTests", dependencies: ["App", "Services", "Data"], path: "Tests"),
    ]
)
