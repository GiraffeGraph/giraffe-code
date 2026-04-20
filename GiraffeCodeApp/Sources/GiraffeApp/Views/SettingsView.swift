import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var giraffePath: String = ""
    @State private var projectPath: String = ""
    @State private var useDevMode: Bool = false

    var body: some View {
        Form {
            Section("Binary") {
                LabeledContent("Giraffe path") {
                    HStack {
                        TextField("giraffe", text: $giraffePath)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 280)
                        Button("Auto-detect") { detectGiraffe() }
                    }
                }
                Text("Path to the `giraffe` binary. Use the full path if it's not on your shell PATH, e.g. `/usr/local/bin/giraffe`.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Developer Mode") {
                Toggle("Use tsx (dev mode)", isOn: $useDevMode)
                if useDevMode {
                    LabeledContent("Project path") {
                        HStack {
                            TextField("/path/to/giraffe-code", text: $projectPath)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 280)
                            Button("Browse…") { selectProjectPath() }
                        }
                    }
                    Text("Runs `npx tsx <path>/src/index.ts` instead of the installed binary. Useful for hacking on Giraffe Code itself.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section("About") {
                LabeledContent("Version", value: "0.2.24-alpha")
                LabeledContent("Project", value: "github.com/GiraffeGraph/giraffe-code")
            }
        }
        .formStyle(.grouped)
        .frame(width: 520)
        .padding()
        .onAppear { loadValues() }
        .onChange(of: giraffePath) { appState.giraffePath = $0 }
        .onChange(of: useDevMode) { appState.useDevMode = $0 }
        .onChange(of: projectPath) { appState.projectPath = $0 }
    }

    private func loadValues() {
        giraffePath = appState.giraffePath
        useDevMode = appState.useDevMode
        projectPath = appState.projectPath
    }

    private func detectGiraffe() {
        let proc = Process()
        proc.launchPath = "/bin/zsh"
        proc.arguments = ["-lc", "which giraffe"]
        let pipe = Pipe()
        proc.standardOutput = pipe
        try? proc.run()
        proc.waitUntilExit()
        if let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) {
            let path = output.trimmingCharacters(in: .whitespacesAndNewlines)
            if !path.isEmpty {
                giraffePath = path
                appState.giraffePath = path
            }
        }
    }

    private func selectProjectPath() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.message = "Select giraffe-code project directory"
        panel.prompt = "Select"
        if panel.runModal() == .OK, let url = panel.url {
            projectPath = url.path
            appState.projectPath = url.path
        }
    }
}
