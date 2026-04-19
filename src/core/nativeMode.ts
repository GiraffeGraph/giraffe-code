import { execFileSync, spawnSync } from "child_process";
import { getConfig } from "../config/loader.js";
import { getUserConfig, setUserConfig } from "../config/userConfig.js";

function commandExists(command: string): boolean {
  try {
    if (process.platform === "win32") {
      execFileSync("where", [command], { stdio: "ignore" });
    } else {
      execFileSync("which", [command], { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function resolveAgentFromArgs(commandArgs: string[]): {
  agentKey: string;
  task: string;
} {
  const config = getConfig();
  const knownAgents = Object.keys(config.agents);

  const userDefault = getUserConfig().native?.defaultAgent;
  const defaultAgent = userDefault && knownAgents.includes(userDefault)
    ? userDefault
    : knownAgents.includes("claude")
      ? "claude"
      : (knownAgents[0] ?? "claude");

  const first = commandArgs[0]?.trim();
  if (first && knownAgents.includes(first)) {
    return {
      agentKey: first,
      task: commandArgs.slice(1).join(" ").trim(),
    };
  }

  return {
    agentKey: defaultAgent,
    task: commandArgs.join(" ").trim(),
  };
}

function buildArgsForNative(agentKey: string, task: string): string[] {
  const config = getConfig();
  const agent = config.agents[agentKey];
  if (!agent) throw new Error(`Unknown agent key: ${agentKey}`);

  const args = [...agent.args];
  const lower = agentKey.toLowerCase();

  // Native mode means real agent UI. Do NOT force -p.
  // For Claude, keep a safe permission default unless caller already set one.
  if (lower === "claude" && !hasFlag(args, "--permission-mode")) {
    const permissionMode =
      process.env["GIRAFFE_CLAUDE_PERMISSION_MODE"] ?? "acceptEdits";
    args.push("--permission-mode", permissionMode);
  }

  if (task) {
    args.push(task);
  }

  return args;
}

/**
 * Launches an agent CLI in true native mode (stdio inherit), so the user sees
 * the agent's original terminal UI 1:1.
 */
export function runNativeAgentSession(commandArgs: string[]): number {
  const { agentKey, task } = resolveAgentFromArgs(commandArgs);
  const config = getConfig();
  const agent = config.agents[agentKey];

  if (!agent) {
    throw new Error(`No config entry for agent: ${agentKey}`);
  }

  if (!commandExists(agent.command)) {
    throw new Error(
      `Agent CLI command not found: "${agent.command}" (agent: ${agentKey}).`
    );
  }

  const args = buildArgsForNative(agentKey, task);

  // Remember latest native choices for better launcher defaults.
  const currentUserConfig = getUserConfig();
  setUserConfig({
    ...currentUserConfig,
    native: {
      ...(currentUserConfig.native ?? {}),
      defaultAgent: agentKey,
      lastTask: task || currentUserConfig.native?.lastTask,
    },
  });

  process.stdout.write(
    `\n🦒 Native mode → ${agent.name} (${agent.command})\n` +
      `${task ? `Task: ${task}\n` : ""}` +
      `Exit the agent UI to return to Giraffe.\n\n`
  );

  const result = spawnSync(agent.command, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 0;
}
