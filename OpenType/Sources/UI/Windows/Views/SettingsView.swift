import SwiftUI
import Utilities

struct SettingsView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            GeneralSettingsView()
                .tabItem { Label("General", systemImage: "gear") }
                .tag(0)

            TranscriptionSettingsView()
                .tabItem { Label("Transcription", systemImage: "waveform") }
                .tag(1)

            AISettingsView()
                .tabItem { Label("AI", systemImage: "brain") }
                .tag(2)

            VoiceModesSettingsView()
                .tabItem { Label("Voice Modes", systemImage: "mic") }
                .tag(3)

            DataSettingsView()
                .tabItem { Label("Data", systemImage: "externaldrive") }
                .tag(4)
        }
        .frame(
            width: Constants.UI.settingsWindowWidth,
            height: Constants.UI.settingsWindowHeight
        )
    }
}
