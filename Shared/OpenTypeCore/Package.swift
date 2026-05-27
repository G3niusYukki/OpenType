// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenTypeCore",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "OpenTypeCore", targets: ["OpenTypeCore"])
    ],
    dependencies: [
        .package(path: "../OpenTypeModels"),
    ],
    targets: [
        .target(
            name: "OpenTypeCore",
            dependencies: ["OpenTypeModels"],
            path: "Sources/OpenTypeCore"
        )
    ]
)
