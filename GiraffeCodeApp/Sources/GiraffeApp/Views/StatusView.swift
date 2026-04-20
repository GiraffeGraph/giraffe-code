import SwiftUI

struct StatusView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            if appState.statusRunner.outputLines.isEmpty && !appState.statusRunner.isRunning {
                emptyState
            } else {
                outputView
            }
        }
        .navigationTitle("Status")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    appState.runStatus()
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .disabled(appState.statusRunner.isRunning)
            }
        }
        .onAppear {
            if appState.statusRunner.outputLines.isEmpty {
                appState.runStatus()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            if appState.statusRunner.isRunning {
                ProgressView("Checking status…")
            } else {
                Image(systemName: "checkmark.seal")
                    .font(.system(size: 44))
                    .foregroundStyle(.secondary.opacity(0.3))
                Text("Auth & configuration status")
                    .foregroundStyle(.secondary)
                Button("Check Now") { appState.runStatus() }
                    .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var outputView: some View {
        TerminalOutputView(runner: appState.statusRunner)
    }
}
