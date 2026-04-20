import SwiftUI

@main
struct GiraffeCodeApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup("Giraffe Code") {
            ContentView()
                .environmentObject(appState)
        }
        .defaultSize(width: 1100, height: 720)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandMenu("Giraffe") {
                Button("Run Task") {
                    appState.selectedNav = .taskRunner
                }
                .keyboardShortcut("r", modifiers: .command)

                Button("Sessions") {
                    appState.selectedNav = .sessions
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])

                Divider()

                Button("Stop Running Task") {
                    appState.taskRunner.stop()
                }
                .keyboardShortcut(".", modifiers: .command)
                .disabled(!appState.taskRunner.isRunning)
            }
        }

        Settings {
            SettingsView()
                .environmentObject(appState)
        }
    }
}
