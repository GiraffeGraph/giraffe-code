import nodePty from "node-pty";
import type { IPty } from "node-pty";
import { execSync } from "child_process";
import { getConfig } from "../config/loader.js";
import { extractHandoff } from "../core/HandoffParser.js";
import { eventBus } from "../core/eventBus.js";

function ensureAgentCommandExists(command: string): void {
  try {
    if (process.platform === "win32") {
      execSync(`where ${command}`, { stdio: "ignore" });
    } else {
      execSync(`command -v ${command}`, { stdio: "ignore", shell: "/bin/bash" });
    }
  } catch {
    throw new Error(
      `Agent CLI command not found: "${command}".\n` +
        `Install it or update config/agents.yaml -> command for this agent.`
    );
  }
}

export abstract class AgentBase {
  abstract readonly agentKey: string;

  protected pty: IPty | null = null;
  protected outputBuffer = "";

  spawn(): void {
    const agentConfig = getConfig().agents[this.agentKey];
    if (!agentConfig) {
      throw new Error(`No config entry for agent: ${this.agentKey}`);
    }

    this.outputBuffer = "";
    ensureAgentCommandExists(agentConfig.command);

    try {
      this.pty = nodePty.spawn(agentConfig.command, agentConfig.args, {
        name: "xterm-256color",
        cols: process.stdout.columns ?? 120,
        rows: process.stdout.rows ?? 40,
        cwd: process.cwd(),
        // node-pty requires Record<string,string>; process.env has undefined values.
        // This cast is safe on macOS/Linux where env values are always strings.
        env: process.env as Record<string, string>,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to start agent command "${agentConfig.command}": ${message}`
      );
    }
  }

  sendTask(instruction: string, handoffContext: string): void {
    if (!this.pty) {
      throw new Error(`PTY not spawned for agent: ${this.agentKey}`);
    }

    const agentConfig = getConfig().agents[this.agentKey];
    if (!agentConfig) {
      throw new Error(`No config entry for agent: ${this.agentKey}`);
    }

    const contextBlock = handoffContext
      ? `Context from previous agent:\n${handoffContext}\n\n`
      : "";

    const fullMessage =
      `${agentConfig.handoff_system_prompt}\n\n${contextBlock}Task:\n${instruction}\r`;

    this.pty.write(fullMessage);
  }

  waitForCompletion(): Promise<string> {
    return new Promise<string>((resolve) => {
      if (!this.pty) {
        resolve("");
        return;
      }

      let settled = false;

      const settle = (output: string): void => {
        if (!settled) {
          settled = true;
          resolve(output);
        }
      };

      this.pty.onData((data: string) => {
        this.outputBuffer += data;
        eventBus.emit("output", data);

        if (extractHandoff(this.outputBuffer)) {
          settle(this.outputBuffer);
        }
      });

      this.pty.onExit(() => {
        settle(this.outputBuffer);
      });
    });
  }

  kill(): void {
    if (this.pty) {
      try {
        this.pty.kill();
      } catch {
        // Ignore errors during kill — PTY may already be gone
      }
      this.pty = null;
    }
  }
}
