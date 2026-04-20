import SwiftUI

struct TerminalOutputView: View {
    @ObservedObject var runner: ProcessRunner

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        if runner.outputLines.isEmpty && !runner.isRunning {
                            emptyState
                        } else {
                            ForEach(runner.outputLines) { line in
                                Text(line.text)
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundStyle(line.isError ? Color.red.opacity(0.9) : Color.green.opacity(0.9))
                                    .textSelection(.enabled)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .id(line.id)
                            }
                            if runner.isRunning {
                                HStack(spacing: 6) {
                                    ProgressView()
                                        .scaleEffect(0.5)
                                        .frame(width: 14, height: 14)
                                    Text("Running…")
                                        .font(.system(.caption, design: .monospaced))
                                        .foregroundStyle(.secondary)
                                }
                                .id("spinner")
                            }
                        }
                    }
                    .padding(14)
                }
                .background(Color(nsColor: .textBackgroundColor).opacity(0.04))
                .background(Color.black.opacity(0.85))
                .onChange(of: runner.outputLines.count) { _ in
                    if let last = runner.outputLines.last {
                        withAnimation(.easeOut(duration: 0.1)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
                .onChange(of: runner.isRunning) { running in
                    if running {
                        proxy.scrollTo("spinner", anchor: .bottom)
                    }
                }
            }

            // line count badge
            if !runner.outputLines.isEmpty {
                HStack {
                    Spacer()
                    Text("\(runner.outputLines.count) lines")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                        .padding(8)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "terminal.fill")
                .font(.system(size: 40))
                .foregroundStyle(.secondary.opacity(0.4))
            Text("Output will appear here")
                .font(.callout)
                .foregroundStyle(.secondary.opacity(0.5))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 80)
    }
}
