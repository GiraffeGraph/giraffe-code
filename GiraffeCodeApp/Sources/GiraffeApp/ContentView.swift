import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationSplitView {
            List(NavItem.allCases, selection: $appState.selectedNav) { item in
                NavigationLink(value: item) {
                    Label(item.rawValue, systemImage: item.icon)
                }
            }
            .navigationSplitViewColumnWidth(min: 160, ideal: 180, max: 220)
            .listStyle(.sidebar)
            .safeAreaInset(edge: .bottom) {
                SidebarFooter()
            }
        } detail: {
            switch appState.selectedNav {
            case .taskRunner:
                TaskRunnerView()
            case .sessions:
                SessionsView()
            case .status:
                StatusView()
            case .doctor:
                DoctorView()
            }
        }
        .navigationTitle("Giraffe Code")
    }
}

struct SidebarFooter: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Divider()
            HStack {
                Image(systemName: "folder")
                    .foregroundStyle(.secondary)
                    .font(.caption)
                Text(URL(fileURLWithPath: appState.workingDirectory).lastPathComponent)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                Button {
                    selectWorkingDirectory()
                } label: {
                    Image(systemName: "pencil")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
    }

    private func selectWorkingDirectory() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = "Select the working directory for Giraffe tasks"
        panel.prompt = "Select"

        if panel.runModal() == .OK, let url = panel.url {
            appState.workingDirectory = url.path
        }
    }
}
