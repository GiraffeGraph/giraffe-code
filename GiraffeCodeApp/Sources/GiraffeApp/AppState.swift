import Foundation
import Combine

enum NavItem: String, CaseIterable, Identifiable {
    case taskRunner = "Task Runner"
    case sessions = "Sessions"
    case status = "Status"
    case doctor = "Doctor"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .taskRunner: return "play.rectangle.fill"
        case .sessions: return "clock.fill"
        case .status: return "checkmark.seal.fill"
        case .doctor: return "stethoscope"
        }
    }
}

enum RunMode: String, CaseIterable {
    case normal = "Orchestrate"
    case chat = "Chat"
    case improve = "Improve"
    case delegate_ = "Delegate"
}

@MainActor
class AppState: ObservableObject {
    @Published var selectedNav: NavItem = .taskRunner
    @Published var workingDirectory: String = FileManager.default.currentDirectoryPath

    // Per-command runners
    let taskRunner = ProcessRunner()
    let statusRunner = ProcessRunner()
    let doctorRunner = ProcessRunner()

    // Giraffe binary path from UserDefaults
    var giraffePath: String {
        get { UserDefaults.standard.string(forKey: "giraffePath") ?? "giraffe" }
        set { UserDefaults.standard.set(newValue, forKey: "giraffePath") }
    }

    var useDevMode: Bool {
        get { UserDefaults.standard.bool(forKey: "useDevMode") }
        set { UserDefaults.standard.set(newValue, forKey: "useDevMode") }
    }

    var projectPath: String {
        get { UserDefaults.standard.string(forKey: "projectPath") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "projectPath") }
    }

    func giraffeCommand() -> String {
        if useDevMode && !projectPath.isEmpty {
            return "npx tsx \(projectPath)/src/index.ts"
        }
        return giraffePath
    }

    func runTask(_ task: String, mode: RunMode, delegateAgent: String) {
        var args: [String]

        switch mode {
        case .normal:
            args = ["--headless", shellEscape(task)]
        case .chat:
            args = ["chat", shellEscape(task)]
        case .improve:
            args = ["improve", "--headless", task.isEmpty ? "" : shellEscape(task)]
        case .delegate_:
            guard !delegateAgent.isEmpty else { return }
            args = ["delegate", delegateAgent, shellEscape(task)]
        }

        args = args.filter { !$0.isEmpty }
        taskRunner.run(command: giraffeCommand(), arguments: args, workingDirectory: workingDirectory)
    }

    func runStatus() {
        statusRunner.run(command: giraffeCommand(), arguments: ["status", "--headless"],
                         workingDirectory: workingDirectory)
    }

    func runDoctor() {
        doctorRunner.run(command: giraffeCommand(), arguments: ["doctor", "--headless"],
                         workingDirectory: workingDirectory)
    }
}

func shellEscape(_ str: String) -> String {
    "'\(str.replacingOccurrences(of: "'", with: "'\\''"))'"
}
