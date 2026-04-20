import SwiftUI

struct TaskRunnerView: View {
    @EnvironmentObject var appState: AppState
    @State private var taskText: String = ""
    @State private var runMode: RunMode = .normal
    @State private var delegateAgent: String = "claude"
    @FocusState private var taskFocused: Bool

    private let agents = ["claude", "codex", "opencode", "pi", "gemini"]

    var body: some View {
        VStack(spacing: 0) {
            inputBar
            Divider()
            TerminalOutputView(runner: appState.taskRunner)
        }
        .navigationTitle("Task Runner")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                if appState.taskRunner.isRunning {
                    Button(role: .destructive) {
                        appState.taskRunner.stop()
                    } label: {
                        Label("Stop", systemImage: "stop.fill")
                    }
                    .foregroundStyle(.red)
                } else {
                    Button {
                        appState.taskRunner.clear()
                    } label: {
                        Label("Clear", systemImage: "trash")
                    }
                    .disabled(appState.taskRunner.outputLines.isEmpty)
                }
            }
        }
        .onAppear { taskFocused = true }
    }

    private var inputBar: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Picker("Mode", selection: $runMode) {
                    ForEach(RunMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 380)

                if runMode == .delegate_ {
                    Picker("Agent", selection: $delegateAgent) {
                        ForEach(agents, id: \.self) { agent in
                            Text(agent.capitalized).tag(agent)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(width: 120)
                }

                Spacer()
            }

            HStack(spacing: 8) {
                TextField(taskPlaceholder, text: $taskText, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .focused($taskFocused)
                    .lineLimit(1...4)
                    .onSubmit { submitTask() }

                Button(action: submitTask) {
                    Label("Run", systemImage: "play.fill")
                        .frame(width: 72)
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.return, modifiers: .command)
                .disabled(appState.taskRunner.isRunning || taskText.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            if let code = appState.taskRunner.exitCode {
                HStack {
                    Image(systemName: code == 0 ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(code == 0 ? .green : .red)
                    Text(code == 0 ? "Completed successfully" : "Exited with code \(code)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
            }
        }
        .padding(14)
        .background(.background)
    }

    private var taskPlaceholder: String {
        switch runMode {
        case .normal: return "Describe your task (e.g. \"Add auth and write tests\")"
        case .chat: return "Ask Giraffe directly…"
        case .improve: return "Improvement focus (optional)"
        case .delegate_: return "Task for \(delegateAgent)…"
        }
    }

    private func submitTask() {
        let trimmed = taskText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty || runMode == .improve else { return }
        guard !appState.taskRunner.isRunning else { return }
        appState.runTask(trimmed, mode: runMode, delegateAgent: delegateAgent)
    }
}
