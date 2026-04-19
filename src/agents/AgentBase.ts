import nodePty from "node-pty";
import type { IPty } from "node-pty";
import {
  execFileSync,
  spawn as childSpawn,
  type ChildProcessWithoutNullStreams,
} from "child_process";
import { getConfig } from "../config/loader.js";
import { extractHandoff } from "../core/HandoffParser.js";
import { eventBus } from "../core/eventBus.js";

function ensureAgentCommandExists(command: string): void {
  try {
    if (process.platform === "win32") {
      execFileSync("where", [command], { stdio: "ignore" });
    } else {
      execFileSync("which", [command], { stdio: "ignore" });
    }
  } catch {
    throw new Error(
      `Agent CLI command not found: "${command}".\n` +
        `Install it or update config/agents.yaml -> command for this agent.`
    );
  }
}

type TransportMode = "pty" | "child_pending" | "child" | null;

function buildFallbackArgs(
  agentKey: string,
  baseArgs: string[],
  prompt: string
): string[] {
  const args = [...baseArgs];
  const lower = agentKey.toLowerCase();
  const hasPrint = args.includes("-p") || args.includes("--print");

  // Known CLIs that support non-interactive print mode.
  if ((lower === "claude" || lower === "pi") && !hasPrint) {
    args.push("-p");
  }

  args.push(prompt);
  return args;
}

export abstract class AgentBase {
  abstract readonly agentKey: string;

  protected pty: IPty | null = null;
  protected child: ChildProcessWithoutNullStreams | null = null;
  protected mode: TransportMode = null;
  protected outputBuffer = "";

  spawn(): void {
    const agentConfig = getConfig().agents[this.agentKey];
    if (!agentConfig) {
      throw new Error(`No config entry for agent: ${this.agentKey}`);
    }

    this.outputBuffer = "";
    this.pty = null;
    this.child = null;
    this.mode = null;

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
      this.mode = "pty";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.mode = "child_pending";
      eventBus.emit(
        "output",
        `\n[AGENT_WARNING] ${this.agentKey}: node-pty spawn failed (${message}). ` +
          `Falling back to non-interactive process mode.\n`
      );
    }
  }

  sendTask(instruction: string, handoffContext: string): void {
    const agentConfig = getConfig().agents[this.agentKey];
    if (!agentConfig) {
      throw new Error(`No config entry for agent: ${this.agentKey}`);
    }

    const contextBlock = handoffContext
      ? `Context from previous agent:\n${handoffContext}\n\n`
      : "";

    const fullMessage =
      `${agentConfig.handoff_system_prompt}\n\n${contextBlock}Task:\n${instruction}`;

    if (this.mode === "pty" && this.pty) {
      this.pty.write(`${fullMessage}\r`);
      return;
    }

    if (this.mode === "child_pending") {
      const args = buildFallbackArgs(this.agentKey, agentConfig.args, fullMessage);

      try {
        this.child = childSpawn(agentConfig.command, args, {
          cwd: process.cwd(),
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
        });
        this.mode = "child";
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Failed to start fallback process "${agentConfig.command}": ${message}`
        );
      }

      return;
    }

    if (this.mode === "child" && this.child?.stdin.writable) {
      // Generic safety net for CLIs that read prompt from stdin.
      this.child.stdin.write(`${fullMessage}\n`);
      this.child.stdin.end();
      return;
    }

    throw new Error(`Agent process not started for agent: ${this.agentKey}`);
  }

  waitForCompletion(): Promise<string> {
    return new Promise<string>((resolve) => {
      let settled = false;

      const settle = (output: string): void => {
        if (!settled) {
          settled = true;
          resolve(output);
        }
      };

      if (this.mode === "pty" && this.pty) {
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

        return;
      }

      if (this.mode === "child" && this.child) {
        this.child.stdout.on("data", (chunk: Buffer) => {
          const data = chunk.toString("utf8");
          this.outputBuffer += data;
          eventBus.emit("output", data);

          if (extractHandoff(this.outputBuffer)) {
            settle(this.outputBuffer);
          }
        });

        this.child.stderr.on("data", (chunk: Buffer) => {
          const data = chunk.toString("utf8");
          this.outputBuffer += data;
          eventBus.emit("output", data);
        });

        this.child.on("error", (err: Error) => {
          const data = `\n[AGENT_ERROR] ${this.agentKey}: ${err.message}\n`;
          this.outputBuffer += data;
          eventBus.emit("output", data);
          settle(this.outputBuffer);
        });

        this.child.on("exit", () => {
          settle(this.outputBuffer);
        });

        return;
      }

      settle("");
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

    if (this.child) {
      try {
        this.child.kill("SIGTERM");
      } catch {
        // Ignore errors during kill — process may already be gone
      }
      this.child = null;
    }

    this.mode = null;
  }
}
