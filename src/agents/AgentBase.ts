import nodePty from "node-pty";
import type { IPty } from "node-pty";
import {
  execFileSync,
  spawn as childSpawn,
  type ChildProcess,
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
type ChildOutputMode = "raw" | "claude_stream_json";

type ChildLaunch = {
  args: string[];
  passPromptViaStdin: boolean;
  outputMode: ChildOutputMode;
};

let ptyDisabled = false;
let ptyDisabledReason = "";
let ptyWarningEmitted = false;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function hasAnyFlag(args: string[], flags: string[]): boolean {
  return flags.some((f) => args.includes(f));
}

function buildFallbackLaunch(
  agentKey: string,
  baseArgs: string[],
  prompt: string
): ChildLaunch {
  const args = [...baseArgs];
  const lower = agentKey.toLowerCase();

  if (lower === "claude") {
    if (!hasAnyFlag(args, ["-p", "--print"])) {
      args.push("-p");
    }
    if (!hasAnyFlag(args, ["--verbose"])) {
      args.push("--verbose");
    }
    if (!hasAnyFlag(args, ["--output-format"])) {
      args.push("--output-format", "stream-json");
    }
    if (!hasAnyFlag(args, ["--include-partial-messages"])) {
      args.push("--include-partial-messages");
    }

    const permissionMode =
      process.env["GIRAFFE_CLAUDE_PERMISSION_MODE"] ?? "acceptEdits";
    if (!hasAnyFlag(args, ["--permission-mode"])) {
      args.push("--permission-mode", permissionMode);
    }

    args.push(prompt);
    return {
      args,
      passPromptViaStdin: false,
      outputMode: "claude_stream_json",
    };
  }

  if (lower === "pi") {
    if (!hasAnyFlag(args, ["-p", "--print"])) {
      args.push("-p");
    }
    args.push(prompt);
    return {
      args,
      passPromptViaStdin: false,
      outputMode: "raw",
    };
  }

  if (hasAnyFlag(args, ["-p", "--print"])) {
    args.push(prompt);
    return {
      args,
      passPromptViaStdin: false,
      outputMode: "raw",
    };
  }

  // Generic fallback for unknown CLIs
  return {
    args,
    passPromptViaStdin: true,
    outputMode: "raw",
  };
}

function extractClaudeTextDelta(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;

  if (root["type"] !== "stream_event") return null;
  const event = asRecord(root["event"]);
  if (!event) return null;

  if (event["type"] !== "content_block_delta") return null;
  const delta = asRecord(event["delta"]);
  if (!delta) return null;

  if (delta["type"] !== "text_delta") return null;
  const text = delta["text"];
  return typeof text === "string" ? text : null;
}

function extractClaudeToolMarker(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;

  if (root["type"] !== "stream_event") return null;
  const event = asRecord(root["event"]);
  if (!event) return null;

  if (event["type"] !== "content_block_start") return null;
  const block = asRecord(event["content_block"]);
  if (!block) return null;

  if (block["type"] !== "tool_use") return null;
  const name = block["name"];
  if (typeof name !== "string" || name.length === 0) return null;

  return `\n🔧 ${name}\n`;
}

function extractClaudeStatus(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;

  if (root["type"] !== "system") return null;
  if (root["subtype"] !== "status") return null;

  const status = root["status"];
  return typeof status === "string" && status.length > 0 ? status : null;
}

function extractClaudeResultError(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;

  if (root["type"] !== "result") return null;
  if (root["is_error"] !== true) return null;
  const result = root["result"];

  return typeof result === "string" ? result : "Claude command failed";
}

export abstract class AgentBase {
  abstract readonly agentKey: string;

  protected pty: IPty | null = null;
  protected child: ChildProcess | null = null;
  protected mode: TransportMode = null;
  protected childNeedsStdin = false;
  protected childOutputMode: ChildOutputMode = "raw";
  protected childJsonLineBuffer = "";
  protected childLastStatus = "";
  protected outputBuffer = "";

  private emitOutput(text: string): void {
    if (!text) return;
    this.outputBuffer += text;
    eventBus.emit("output", text);
  }

  private processClaudeStreamJsonChunk(chunk: string): void {
    this.childJsonLineBuffer += chunk;

    while (true) {
      const newlineIndex = this.childJsonLineBuffer.indexOf("\n");
      if (newlineIndex < 0) break;

      const rawLine = this.childJsonLineBuffer.slice(0, newlineIndex);
      this.childJsonLineBuffer = this.childJsonLineBuffer.slice(newlineIndex + 1);

      const line = rawLine.trim();
      if (!line) continue;

      let payload: unknown;
      try {
        payload = JSON.parse(line);
      } catch {
        // Ignore non-JSON diagnostics when in stream-json mode.
        continue;
      }

      const status = extractClaudeStatus(payload);
      if (status && status !== this.childLastStatus) {
        this.childLastStatus = status;
        this.emitOutput(`\n⏳ ${status}\n`);
      }

      const toolMarker = extractClaudeToolMarker(payload);
      if (toolMarker) {
        this.emitOutput(toolMarker);
      }

      const delta = extractClaudeTextDelta(payload);
      if (delta) {
        this.emitOutput(delta);
      }

      const resultError = extractClaudeResultError(payload);
      if (resultError) {
        this.emitOutput(`\n[CLAUDE_ERROR] ${resultError}\n`);
      }
    }
  }

  spawn(): void {
    const agentConfig = getConfig().agents[this.agentKey];
    if (!agentConfig) {
      throw new Error(`No config entry for agent: ${this.agentKey}`);
    }

    this.outputBuffer = "";
    this.pty = null;
    this.child = null;
    this.mode = null;
    this.childNeedsStdin = false;
    this.childOutputMode = "raw";
    this.childJsonLineBuffer = "";
    this.childLastStatus = "";

    ensureAgentCommandExists(agentConfig.command);

    if (ptyDisabled) {
      this.mode = "child_pending";
      return;
    }

    try {
      this.pty = nodePty.spawn(agentConfig.command, agentConfig.args, {
        name: "xterm-256color",
        cols: process.stdout.columns ?? 120,
        rows: process.stdout.rows ?? 40,
        cwd: process.cwd(),
        env: process.env as Record<string, string>,
      });
      this.mode = "pty";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ptyDisabled = true;
      ptyDisabledReason = message;
      this.mode = "child_pending";

      if (!ptyWarningEmitted) {
        ptyWarningEmitted = true;
        if (process.env["GIRAFFE_DEBUG"] === "1") {
          eventBus.emit(
            "output",
            `\n[AGENT_WARNING] node-pty is unavailable (${ptyDisabledReason}). ` +
              `Using fallback process mode.\n`
          );
        }
      }
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
      const launch = buildFallbackLaunch(
        this.agentKey,
        agentConfig.args,
        fullMessage
      );

      this.childNeedsStdin = launch.passPromptViaStdin;
      this.childOutputMode = launch.outputMode;

      try {
        this.child = childSpawn(agentConfig.command, launch.args, {
          cwd: process.cwd(),
          env: process.env,
          stdio: [this.childNeedsStdin ? "pipe" : "ignore", "pipe", "pipe"],
        });
        this.mode = "child";
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Failed to start fallback process "${agentConfig.command}": ${message}`
        );
      }

      if (this.childNeedsStdin && this.child.stdin?.writable) {
        this.child.stdin.write(`${fullMessage}\n`);
        this.child.stdin.end();
        this.childNeedsStdin = false;
      }

      return;
    }

    if (
      this.mode === "child" &&
      this.childNeedsStdin &&
      this.child?.stdin?.writable
    ) {
      this.child.stdin.write(`${fullMessage}\n`);
      this.child.stdin.end();
      this.childNeedsStdin = false;
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
          this.emitOutput(data);

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
        this.child.stdout?.on("data", (chunk: Buffer) => {
          const data = chunk.toString("utf8");

          if (this.childOutputMode === "claude_stream_json") {
            this.processClaudeStreamJsonChunk(data);
          } else {
            this.emitOutput(data);
          }

          if (extractHandoff(this.outputBuffer)) {
            settle(this.outputBuffer);
          }
        });

        this.child.stderr?.on("data", (chunk: Buffer) => {
          const data = chunk.toString("utf8");

          // In stream-json mode, Claude emits useful content to stdout.
          // Keep stderr mostly quiet, except explicit errors.
          if (this.childOutputMode === "claude_stream_json") {
            const lower = data.toLowerCase();
            if (lower.includes("error") || lower.includes("failed")) {
              this.emitOutput(data);
            }
            return;
          }

          this.emitOutput(data);
        });

        this.child.on("error", (err: Error) => {
          this.emitOutput(`\n[AGENT_ERROR] ${this.agentKey}: ${err.message}\n`);
          settle(this.outputBuffer);
        });

        this.child.on("exit", () => {
          if (
            this.childOutputMode === "claude_stream_json" &&
            this.childJsonLineBuffer.trim().length > 0
          ) {
            this.processClaudeStreamJsonChunk("\n");
          }

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
    this.childNeedsStdin = false;
    this.childOutputMode = "raw";
    this.childJsonLineBuffer = "";
    this.childLastStatus = "";
  }
}
