import SwiftUI

struct DoctorView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            if appState.doctorRunner.outputLines.isEmpty && !appState.doctorRunner.isRunning {
                emptyState
            } else {
                TerminalOutputView(runner: appState.doctorRunner)
            }
        }
        .navigationTitle("Doctor")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    appState.runDoctor()
                } label: {
                    Label("Run Doctor", systemImage: "stethoscope")
                }
                .disabled(appState.doctorRunner.isRunning)
            }
        }
        .onAppear {
            if appState.doctorRunner.outputLines.isEmpty {
                appState.runDoctor()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            if appState.doctorRunner.isRunning {
                ProgressView("Running health checks…")
            } else {
                Image(systemName: "stethoscope")
                    .font(.system(size: 44))
                    .foregroundStyle(.secondary.opacity(0.3))
                Text("Check auth, config, and agent CLIs")
                    .foregroundStyle(.secondary)
                Button("Run Doctor") { appState.runDoctor() }
                    .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
