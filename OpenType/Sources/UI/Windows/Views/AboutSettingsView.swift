import SwiftUI

struct AboutSettingsView: View {
    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            // App icon
            if let appIcon = NSImage(named: NSImage.applicationIconName) {
                Image(nsImage: appIcon)
                    .resizable()
                    .frame(width: 80, height: 80)
            }

            // App name
            Text("OpenType")
                .font(.title.bold())

            // Version
            Text("Version \(appVersion) (Build \(buildNumber))")
                .font(.subheadline)
                .foregroundColor(.secondary)

            // Links
            VStack(spacing: 8) {
                Link("GitHub Repository", destination: URL(string: "https://github.com/G3niusYukki/OpenType")!)
                    .font(.caption)

                Link("MIT License", destination: URL(string: "https://github.com/G3niusYukki/OpenType/blob/main/LICENSE")!)
                    .font(.caption)
            }

            // Credits
            VStack(spacing: 4) {
                Text("Built with Swift + AppKit + SwiftUI")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text("macOS 13+")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .frame(width: 300, height: 300)
        .padding()
    }

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
    }

    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }
}
