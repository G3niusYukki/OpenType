import SwiftUI
import Utilities

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HistoryView()
                .tabItem { Label("History", systemImage: "clock") }
                .tag(0)

            DictionaryView()
                .tabItem { Label("Dictionary", systemImage: "book") }
                .tag(1)

            ProfilesView()
                .tabItem { Label("Profiles", systemImage: "person.crop.circle") }
                .tag(2)
        }
        .frame(
            minWidth: Constants.UI.mainWindowWidth,
            minHeight: Constants.UI.mainWindowHeight
        )
    }
}
