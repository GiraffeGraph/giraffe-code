#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./tui/screens/App.js";
import { LoginSelector } from "./tui/screens/LoginSelector.js";
import { ModelSelector } from "./tui/screens/ModelSelector.js";
import { StatusScreen } from "./tui/screens/StatusScreen.js";
import { LogoutSelector } from "./tui/screens/LogoutSelector.js";
import { DoctorScreen } from "./tui/screens/DoctorScreen.js";
import { NativeLauncher } from "./tui/screens/NativeLauncher.js";
import { runNativeAgentSession } from "./core/runtime/nativeMode.js";
import { buildSelfImproveTask } from "./core/improvePrompt.js";
import { runHeadlessTask } from "./core/runtime/headlessRunner.js";
import { runChatReply, runResumeTask } from "./core/runtime/runModes.js";
import {
  listRecentWorkspaceSessions,
  renderLatestWorkspaceHandoff,
} from "./core/runtime/workspaceRuntime.js";
import { getConfig, setConfigPath } from "./config/loader.js";
import { hasAnyCredential, removeCredential } from "./auth/storage.js";

// ── Parse CLI arguments ───────────────────────────────────────────────────────

const args = process.argv.slice(2);

const nodeMajor = Number(process.versions.node.split(".")[0] ?? "0");
if (nodeMajor >= 25 && process.env["GIRAFFE_SUPPRESS_NODE_WARNING"] !== "1") {
  process.stderr.write(
    "\n[Giraffe Code] Warning: Node 25 may break interactive PTY mode (node-pty spawn).\n" +
      "Use Node 22/24 LTS for full agent terminal UI.\n\n"
  );
}

const COMMANDS = ["login", "model", "status", "logout", "doctor", "native", "improve", "chat", "delegate", "resume", "handoff", "sessions", "help"] as const;
type Command = (typeof COMMANDS)[number];

let command: Command | undefined;
const commandArgs: string[] = [];
let configOverride: string | undefined;
let forceHeadless = false;
const taskParts: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!command && COMMANDS.includes(arg as Command)) {
    command = arg as Command;
  } else if (arg === "--config" && i + 1 < args.length) {
    configOverride = args[++i];
  } else if (arg === "--headless") {
    forceHeadless = true;
  } else if (arg === "--help" || arg === "-h") {
    command = "help";
  } else if (!arg.startsWith("--")) {
    if (command) {
      commandArgs.push(arg);
    } else {
      taskParts.push(arg);
    }
  }
}

const commandArg = commandArgs[0];

const task = taskParts.join(" ").trim();
const improveFocus = command === "improve" ? commandArgs.join(" ").trim() : "";
const delegateAgentArg = command === "delegate" ? (commandArgs[0] ?? "") : "";
const delegateTask = command === "delegate" ? commandArgs.slice(1).join(" ").trim() : "";
const initialTask = command === "improve"
  ? buildSelfImproveTask(improveFocus)
  : command === "chat"
    ? commandArgs.join(" ").trim()
    : command === "delegate"
      ? delegateTask
      : task;
const isInteractiveTty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const shouldRunHeadless = forceHeadless || !isInteractiveTty;

// ── Help ──────────────────────────────────────────────────────────────────────

if (command === "help") {
  process.stdout.write(`
🦒 Giraffe Code — multi-agent AI orchestration

Usage:
  giraffe [task]                 Run agents on a task
  giraffe                        Interactive mode (prompt for task)

Commands:
  giraffe login                  Authenticate with an LLM provider
  giraffe logout [provider]      Remove saved credentials
  giraffe model                  Choose the planner model
  giraffe status                 Show auth + config status
  giraffe doctor                 Run health checks (auth/config/agent CLIs)
  giraffe native                 Open native launcher (agent picker + presets)
  giraffe native [agent] [task]  Launch real agent UI (1:1 terminal handover)
  giraffe improve [focus]        Dogfood mode: use Giraffe to improve this repo
  giraffe chat [message]         Ask Giraffe directly (no delegation)
  giraffe delegate <agent> <task>  Run one agent manually via Giraffe
  giraffe resume                 Resume from .giraffe/handoffs/latest
  giraffe handoff                Print latest workspace handoff
  giraffe sessions               List recent .giraffe sessions
  giraffe help                   Show this help

Flags:
  --config <path>                Use a custom agents.yaml
  --headless                     Run task without Ink TUI (CI/non-TTY friendly)

Examples:
  giraffe "Add auth and write tests"
  giraffe login
  giraffe model
  giraffe logout anthropic
  giraffe status
  giraffe doctor
  giraffe native
  giraffe native claude "build a todo app"
  giraffe improve
  giraffe improve "focus on onboarding UX and docs"
  giraffe improve --headless "focus on planner reliability"
  giraffe chat "what should we refactor next?"
  giraffe delegate codex "build a todo app"
  giraffe resume
  giraffe handoff
  giraffe sessions
`);
  process.exit(0);
}

// ── Apply overrides and validate config ───────────────────────────────────────

if (configOverride) {
  setConfigPath(configOverride);
}

if (command !== "status" && command !== "doctor") {
  // status/doctor read config themselves; others need it validated first
  try {
    getConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\n[Giraffe Code] Config error:\n${message}\n\n`);
    process.exit(1);
  }
}

const commandNeedsInteractiveTui =
  command === "login" ||
  command === "model" ||
  command === "status" ||
  command === "doctor" ||
  (command === "logout" && !commandArg) ||
  (command === "native" && commandArgs.length === 0);

if (commandNeedsInteractiveTui && !isInteractiveTty) {
  process.stderr.write(
    "\n[Giraffe Code] This command requires an interactive terminal (TTY).\n" +
      "Open a real terminal and retry, or use task commands with --headless.\n\n"
  );
  process.exit(1);
}

// ── giraffe login ─────────────────────────────────────────────────────────────

if (command === "login") {
  const { unmount } = render(
    React.createElement(LoginSelector, {
      onComplete: (_providerId) => {
        unmount();
        process.stdout.write("\nLogin saved to ~/.giraffe/auth.json\n");
        process.exit(0);
      },
    })
  );
  process.on("SIGINT", () => { unmount(); process.exit(0); });

// ── giraffe logout [provider] ─────────────────────────────────────────────────

} else if (command === "logout") {
  if (commandArg) {
    // Direct removal: giraffe logout anthropic
    const removed = removeCredential(commandArg);
    if (removed) {
      process.stdout.write(`\nLogged out: ${commandArg}\n`);
    } else {
      process.stdout.write(`\nNo credentials found for: ${commandArg}\n`);
    }
    process.exit(0);
  } else {
    // Interactive selector
    const { unmount } = render(
      React.createElement(LogoutSelector, {
        onComplete: () => {
          unmount();
          process.exit(0);
        },
      })
    );
    process.on("SIGINT", () => { unmount(); process.exit(0); });
  }

// ── giraffe model ─────────────────────────────────────────────────────────────

} else if (command === "model") {
  const { unmount } = render(
    React.createElement(ModelSelector, {
      onComplete: () => {
        unmount();
        process.stdout.write("\nPlanner model saved to ~/.giraffe/config.json\n");
        process.exit(0);
      },
    })
  );
  process.on("SIGINT", () => { unmount(); process.exit(0); });

// ── giraffe status ────────────────────────────────────────────────────────────

} else if (command === "status") {
  const { unmount } = render(
    React.createElement(StatusScreen, {
      onDone: () => {
        unmount();
        process.exit(0);
      },
    })
  );
  process.on("SIGINT", () => { unmount(); process.exit(0); });

// ── giraffe doctor ────────────────────────────────────────────────────────────

} else if (command === "doctor") {
  const { unmount } = render(
    React.createElement(DoctorScreen, {
      onDone: () => {
        unmount();
        process.exit(0);
      },
    })
  );
  process.on("SIGINT", () => { unmount(); process.exit(0); });

// ── giraffe native [agent] [task] ────────────────────────────────────────────

} else if (command === "native") {
  if (commandArgs.length === 0) {
    const { unmount } = render(
      React.createElement(NativeLauncher, {
        onLaunch: (args: string[]) => {
          unmount();
          try {
            const code = runNativeAgentSession(args);
            process.exit(code);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write(`\n[Giraffe Code] Native mode error:\n${message}\n\n`);
            process.exit(1);
          }
        },
        onCancel: () => {
          unmount();
          process.exit(0);
        },
      })
    );
    process.on("SIGINT", () => { unmount(); process.exit(0); });
  } else {
    try {
      const code = runNativeAgentSession(commandArgs);
      process.exit(code);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\n[Giraffe Code] Native mode error:\n${message}\n\n`);
      process.exit(1);
    }
  }

// ── Normal run ────────────────────────────────────────────────────────────────

} else {
  const needsLogin = !hasAnyCredential();

  if (command === "chat") {
    if (!initialTask) {
      process.stderr.write("\n[Giraffe Code] Chat mode requires a message.\n\n");
      process.exit(1);
    }

    runChatReply(initialTask)
      .then((reply) => {
        process.stdout.write(`\n🦒 ${reply}\n`);
        process.exit(0);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`\n[Giraffe Code] Chat failed:\n${message}\n\n`);
        process.exit(1);
      });
  } else if (command === "delegate") {
    if (!delegateAgentArg || !delegateTask) {
      process.stderr.write(
        "\n[Giraffe Code] Delegate mode usage: giraffe delegate <agent> <task>\n\n"
      );
      process.exit(1);
    }

    runHeadlessTask(delegateTask, { delegateAgent: delegateAgentArg })
      .then((code) => process.exit(code))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`\n[Giraffe Code] Delegate run failed:\n${message}\n\n`);
        process.exit(1);
      });
  } else if (command === "resume") {
    runResumeTask()
      .then(() => process.exit(0))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`\n[Giraffe Code] Resume failed:\n${message}\n\n`);
        process.exit(1);
      });
  } else if (command === "handoff") {
    process.stdout.write(`\n${renderLatestWorkspaceHandoff()}\n`);
    process.exit(0);
  } else if (command === "sessions") {
    const sessions = listRecentWorkspaceSessions(12);
    if (sessions.length === 0) {
      process.stdout.write("\nNo .giraffe sessions found yet.\n");
    } else {
      process.stdout.write("\nRecent .giraffe sessions:\n");
      for (const session of sessions) {
        process.stdout.write(`- ${session.sessionId}  ${session.path}\n`);
      }
    }
    process.exit(0);
  } else if (shouldRunHeadless) {
    if (!initialTask) {
      process.stderr.write(
        "\n[Giraffe Code] Non-interactive mode requires a task.\n" +
        "Try: giraffe \"your task\" or giraffe improve --headless\n\n"
      );
      process.exit(1);
    }

    if (needsLogin) {
      process.stderr.write(
        "\n[Giraffe Code] No credentials found.\n" +
        "Run `giraffe login` in a real terminal first, then retry with --headless.\n\n"
      );
      process.exit(1);
    }

    runHeadlessTask(initialTask)
      .then((code) => process.exit(code))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`\n[Giraffe Code] Headless run failed:\n${message}\n\n`);
        process.exit(1);
      });
  } else {
    const { unmount } = render(
      React.createElement(App, {
        initialTask,
        needsLogin,
      })
    );
    process.on("SIGINT", () => { unmount(); process.exit(0); });
  }
}
