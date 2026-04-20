// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "GiraffeCodeApp",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "GiraffeApp",
            path: "Sources/GiraffeApp"
        )
    ]
)
