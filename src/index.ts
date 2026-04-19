#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./tui/App.js";
import { LoginSelector } from "./tui/LoginSelector.js";
import { getConfig, setConfigPath } from "./config/loader.js";
import { hasAnyCredential } from "./auth/storage.js";

// ── Parse CLI arguments ───────────────────────────────────────────────────────

const args = process.argv.slice(2);

let configOverride: string | undefined;
const taskParts: string[] = [];
let isLoginCommand = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "login") {
    isLoginCommand = true;
  } else if (arg === "--config" && i + 1 < args.length) {
    configOverride = args[++i];
  } else if (!arg.startsWith("--")) {
    taskParts.push(arg);
  }
}

const task = taskParts.join(" ").trim();

// ── Apply overrides and validate config ───────────────────────────────────────

if (configOverride) {
  setConfigPath(configOverride);
}

try {
  getConfig(); // Fail fast if agents.yaml is missing or malformed
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n[Giraffe Code] Config error:\n${message}\n\n`);
  process.exit(1);
}

// ── giraffe login — explicit re-authentication ────────────────────────────────

if (isLoginCommand) {
  const { unmount } = render(
    React.createElement(LoginSelector, {
      onComplete: (_providerId) => {
        unmount();
        process.stdout.write("\nLogin saved to ~/.giraffe/auth.json\n");
        process.exit(0);
      },
    })
  );

  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });

} else {
  // ── Normal run — check if login is needed first ──────────────────────────
  const needsLogin = !hasAnyCredential();

  const { unmount } = render(
    React.createElement(App, {
      initialTask: task,
      needsLogin,
    })
  );

  process.on("SIGINT", () => {
    unmount();
    process.exit(0);
  });
}
