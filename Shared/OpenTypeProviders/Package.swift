// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenTypeProviders",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "OpenTypeProviders", targets: ["OpenTypeProviders"])
    ],
    dependencies: [
        .package(path: "../OpenTypeModels"),
        .package(path: "../OpenTypeCore"),
        .package(path: "../OpenTypeData"),
    ],
    targets: [
        .target(
            name: "OpenTypeProviders",
            dependencies: ["OpenTypeModels", "OpenTypeCore", "OpenTypeData"],
            path: "Sources/OpenTypeProviders"
        )
    ]
)
