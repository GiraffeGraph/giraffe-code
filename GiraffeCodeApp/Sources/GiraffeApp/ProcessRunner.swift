import Foundation

struct OutputLine: Identifiable {
    let id = UUID()
    let text: String
    let isError: Bool
    let timestamp: Date = Date()
}

@MainActor
class ProcessRunner: ObservableObject {
    @Published var outputLines: [OutputLine] = []
    @Published var isRunning: Bool = false
    @Published var exitCode: Int32? = nil

    private var process: Process?

    func run(command: String, arguments: [String], workingDirectory: String?) {
        guard !isRunning else { return }
        outputLines = []
        exitCode = nil
        isRunning = true

        let fullCmd = ([command] + arguments).joined(separator: " ")
        let proc = Process()
        proc.launchPath = "/bin/zsh"
        proc.arguments = ["-lc", fullCmd]

        if let dir = workingDirectory {
            proc.currentDirectoryURL = URL(fileURLWithPath: dir)
        }

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        proc.standardOutput = stdoutPipe
        proc.standardError = stderrPipe

        stdoutPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let str = String(data: data, encoding: .utf8) else { return }
            let lines = str.components(separatedBy: "\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            Task { @MainActor [weak self] in
                for line in lines {
                    self?.outputLines.append(OutputLine(text: stripANSI(line), isError: false))
                }
            }
        }

        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let str = String(data: data, encoding: .utf8) else { return }
            let lines = str.components(separatedBy: "\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            Task { @MainActor [weak self] in
                for line in lines {
                    self?.outputLines.append(OutputLine(text: stripANSI(line), isError: true))
                }
            }
        }

        proc.terminationHandler = { [weak self] p in
            Task { @MainActor [weak self] in
                self?.isRunning = false
                self?.exitCode = p.terminationStatus
                self?.process = nil
            }
        }

        self.process = proc

        do {
            try proc.run()
        } catch {
            outputLines.append(OutputLine(text: "Failed to launch: \(error.localizedDescription)", isError: true))
            isRunning = false
            self.process = nil
        }
    }

    func stop() {
        process?.interrupt()
        process?.terminate()
    }

    func clear() {
        outputLines = []
        exitCode = nil
    }
}

func stripANSI(_ s: String) -> String {
    let pattern = #"\x1B\[[0-9;]*[mGKHFABCDJsu]|\x1B\][^\x07]*\x07|\x1B[()][0-9A-Za-z]|\r"#
    return (try? s.replacingOccurrences(of: pattern, with: "", options: .regularExpression)) ?? s
}
