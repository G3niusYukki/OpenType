// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenTypeModels",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "OpenTypeModels", targets: ["OpenTypeModels"])
    ],
    targets: [
        .target(
            name: "OpenTypeModels",
            path: "Sources/OpenTypeModels"
        )
    ]
)
