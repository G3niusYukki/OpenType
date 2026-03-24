import SwiftUI
import Utilities

struct PopoverView: View {
    var body: some View {
        VStack {
            Text("OpenType Popover")
                .padding()
            Text("Recording UI coming soon")
                .foregroundColor(.secondary)
        }
        .frame(width: Constants.UI.popoverWidth, height: Constants.UI.popoverHeight)
    }
}
