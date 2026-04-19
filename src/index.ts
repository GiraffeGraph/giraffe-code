#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./tui/App.js";
import { LoginSelector } from "./tui/LoginSelector.js";
import { ModelSelector } from "./tui/ModelSelector.js";
import { StatusScreen } from "./tui/StatusScreen.js";
import { LogoutSelector } from "./tui/LogoutSelector.js";
import { DoctorScreen } from "./tui/DoctorScreen.js";
import { NativeLauncher } from "./tui/NativeLauncher.js";
import { runNativeAgentSession } from "./core/nativeMode.js";
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

const COMMANDS = ["login", "model", "status", "logout", "doctor", "native", "help"] as const;
type Command = (typeof COMMANDS)[number];

let command: Command | undefined;
const commandArgs: string[] = [];
let configOverride: string | undefined;
const taskParts: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!command && COMMANDS.includes(arg as Command)) {
    command = arg as Command;
  } else if (arg === "--config" && i + 1 < args.length) {
    configOverride = args[++i];
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
  giraffe help                   Show this help

Flags:
  --config <path>                Use a custom agents.yaml

Examples:
  giraffe "Add auth and write tests"
  giraffe login
  giraffe model
  giraffe logout anthropic
  giraffe status
  giraffe doctor
  giraffe native
  giraffe native claude "build a todo app"
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

  const { unmount } = render(
    React.createElement(App, {
      initialTask: task,
      needsLogin,
    })
  );
  process.on("SIGINT", () => { unmount(); process.exit(0); });
}
