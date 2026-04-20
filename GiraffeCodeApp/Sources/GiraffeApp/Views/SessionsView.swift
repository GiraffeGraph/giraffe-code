import SwiftUI
import Foundation

struct StoredHandoff: Codable, Identifiable, Hashable {
    var id: String { sessionId }
    let sessionId: String
    let mode: String
    let task: String
    let summary: String
    let generatedAt: String
    let agents: [AgentOutcome]?

    struct AgentOutcome: Codable, Hashable {
        let agentKey: String?
        let completed: String?
        let files: String?
        let context: String?
    }
}

struct SessionsView: View {
    @EnvironmentObject var appState: AppState
    @State private var sessions: [StoredHandoff] = []
    @State private var selected: StoredHandoff?
    @State private var isLoading = false

    var body: some View {
        HSplitView {
            sessionList
            sessionDetail
        }
        .navigationTitle("Sessions")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    loadSessions()
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
            }
        }
        .onAppear { loadSessions() }
        .onChange(of: appState.workingDirectory) { _ in loadSessions() }
    }

    private var sessionList: some View {
        Group {
            if isLoading {
                ProgressView("Loading sessions…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if sessions.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "tray")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary.opacity(0.4))
                    Text("No sessions found")
                        .foregroundStyle(.secondary)
                    Text("Run a task in the working directory first")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(sessions, selection: $selected) { session in
                    SessionRow(session: session)
                        .tag(session)
                }
                .listStyle(.inset)
            }
        }
        .frame(minWidth: 260, idealWidth: 300, maxWidth: 360)
    }

    @ViewBuilder
    private var sessionDetail: some View {
        if let session = selected {
            SessionDetailView(session: session)
        } else {
            VStack(spacing: 12) {
                Image(systemName: "doc.text")
                    .font(.system(size: 40))
                    .foregroundStyle(.secondary.opacity(0.3))
                Text("Select a session")
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func loadSessions() {
        isLoading = true
        selected = nil

        Task {
            let dir = URL(fileURLWithPath: appState.workingDirectory)
                .appendingPathComponent(".giraffe/handoffs")

            var found: [StoredHandoff] = []
            if let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey], options: .skipsHiddenFiles) {
                let jsonFiles = files.filter { $0.pathExtension == "json" }
                    .sorted { a, b in
                        let dateA = (try? a.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                        let dateB = (try? b.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                        return dateA > dateB
                    }

                for file in jsonFiles.prefix(50) {
                    if let data = try? Data(contentsOf: file),
                       let session = try? JSONDecoder().decode(StoredHandoff.self, from: data) {
                        found.append(session)
                    }
                }
            }

            await MainActor.run {
                sessions = found
                isLoading = false
            }
        }
    }
}

struct SessionRow: View {
    let session: StoredHandoff

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Label(session.mode.capitalized, systemImage: modeIcon(session.mode))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formattedDate(session.generatedAt))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            Text(session.task)
                .font(.callout)
                .lineLimit(2)
            if !session.summary.isEmpty {
                Text(session.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 4)
    }

    private func modeIcon(_ mode: String) -> String {
        switch mode.lowercased() {
        case "chat": return "bubble.left.fill"
        case "delegate": return "arrow.right.circle.fill"
        case "native": return "terminal.fill"
        default: return "bolt.fill"
        }
    }

    private func formattedDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: iso) else {
            // try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date2 = formatter.date(from: iso) else { return iso }
            return RelativeDateTimeFormatter().localizedString(for: date2, relativeTo: Date())
        }
        return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: Date())
    }
}

struct SessionDetailView: View {
    let session: StoredHandoff

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Group {
                    infoCard
                    if let agents = session.agents, !agents.isEmpty {
                        agentCard(agents)
                    }
                }
                .padding(.horizontal, 20)
            }
            .padding(.vertical, 20)
        }
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Session", systemImage: "clock.badge.checkmark")
                .font(.headline)

            infoRow("ID", session.sessionId)
            infoRow("Mode", session.mode.capitalized)
            infoRow("Task", session.task)
            if !session.summary.isEmpty {
                infoRow("Summary", session.summary)
            }
        }
        .padding(16)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.separator, lineWidth: 0.5))
    }

    private func agentCard(_ agents: [StoredHandoff.AgentOutcome]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Agent Handoffs", systemImage: "arrow.triangle.2.circlepath")
                .font(.headline)

            ForEach(agents.indices, id: \.self) { i in
                let agent = agents[i]
                VStack(alignment: .leading, spacing: 6) {
                    Text(agent.agentKey ?? "Unknown")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    if let completed = agent.completed {
                        Text(completed)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let files = agent.files, files != "none" {
                        Label(files, systemImage: "doc.fill")
                            .font(.caption)
                            .foregroundStyle(.blue)
                    }
                    if let context = agent.context {
                        Text(context)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(8)
                            .background(.secondary.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
                if i < agents.count - 1 { Divider() }
            }
        }
        .padding(16)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.separator, lineWidth: 0.5))
    }

    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 70, alignment: .trailing)
            Text(value)
                .font(.caption)
                .textSelection(.enabled)
            Spacer()
        }
    }
}
