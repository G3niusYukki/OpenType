// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenTypeData",
    platforms: [
        .macOS(.v13),
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "OpenTypeData",
            targets: ["OpenTypeData"]
        )
    ],
    dependencies: [
        .package(path: "../OpenTypeModels"),
        .package(path: "../OpenTypeCore"),
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.2.2"),
        .package(url: "https://github.com/stephencelis/SQLite.swift", from: "0.16.0")
    ],
    targets: [
        .target(
            name: "OpenTypeData",
            dependencies: [
                "OpenTypeModels",
                "OpenTypeCore",
                "KeychainAccess",
                .product(name: "SQLite", package: "SQLite.swift")
            ]
        )
    ]
)
