#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./tui/App.js";
import { getConfig, setConfigPath, validateApiKey } from "./config/loader.js";

// Parse CLI arguments
const args = process.argv.slice(2);

let configOverride: string | undefined;
let chainOverride: string | undefined;
const taskParts: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--config" && i + 1 < args.length) {
    configOverride = args[++i];
  } else if (arg === "--chain" && i + 1 < args.length) {
    chainOverride = args[++i];
  } else if (!arg.startsWith("--")) {
    taskParts.push(arg);
  }
}

const task = taskParts.join(" ").trim();

// Apply config path override before any config access
if (configOverride) {
  setConfigPath(configOverride);
}

// Validate prerequisites before rendering the TUI
try {
  validateApiKey();
  getConfig(); // Fail fast if agents.yaml is missing or invalid
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n[Giraffe Code] Startup error:\n${message}\n\n`);
  process.exit(1);
}

// If --chain was passed, we could override taskPlan here (Phase 3 feature)
if (chainOverride) {
  process.stderr.write(
    `[Giraffe Code] --chain flag noted (${chainOverride}). ` +
      `Manual chain override is a Phase 3 feature; using LLM planner for now.\n`
  );
}

// Render the TUI — App handles graph invocation internally
const { unmount } = render(React.createElement(App, { initialTask: task }));

// Keep the process alive until the user quits or the graph completes.
// The App component calls process.exit(0) on 'q' keypress.
// On natural completion, the 'done' event triggers a status update,
// and the user presses 'q' to exit.
process.on("SIGINT", () => {
  unmount();
  process.exit(0);
});
