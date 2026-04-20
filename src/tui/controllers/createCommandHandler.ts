import { getConfig } from "../../config/loader.js";
import { eventBus } from "../../core/runtime/eventBus.js";
import { buildSelfImproveTask } from "../../core/improvePrompt.js";
import {
  listRecentWorkspaceSessions,
  renderLatestWorkspaceHandoff,
} from "../../core/runtime/workspaceRuntime.js";
import type { InteractiveMode, RunSetters } from "./controllerShared.js";
import { parseInlineArgs } from "./controllerShared.js";

interface CommandHandlerDeps {
  mode: InteractiveMode;
  delegateAgent: string;
  runSetters: RunSetters;
  setMode: (mode: InteractiveMode) => void;
  setDelegateAgent: (agent: string) => void;
  setTask: (task: string) => void;
  launchNative: (args: string[]) => void;
  persistWorkspaceMode: (mode: InteractiveMode, delegateAgent?: string) => void;
  startGraph: (task: string) => void;
  startDelegate: (agentKey: string, task: string) => void;
  startResume: () => void;
}

export function createCommandHandler({
  mode,
  delegateAgent,
  runSetters,
  setMode,
  setDelegateAgent,
  setTask,
  launchNative,
  persistWorkspaceMode,
  startGraph,
  startDelegate,
  startResume,
}: CommandHandlerDeps) {
  return (cmd: string): void => {
    if (cmd === "/login") return runSetters.setScreen("login");
    if (cmd === "/model") return runSetters.setScreen("model");
    if (cmd === "/status") return runSetters.setScreen("status");
    if (cmd === "/logout") return runSetters.setScreen("logout");
    if (cmd === "/doctor") return runSetters.setScreen("doctor");
    if (cmd === "/native") return runSetters.setScreen("native_launcher");

    if (cmd.startsWith("/native ")) {
      launchNative(parseInlineArgs(cmd).slice(1));
      return;
    }

    if (cmd === "/improve" || cmd.startsWith("/improve ")) {
      const focus = cmd === "/improve" ? "" : cmd.slice("/improve".length).trim();
      const generated = buildSelfImproveTask(focus);
      setTask(generated);
      startGraph(generated);
      return;
    }

    if (cmd === "/resume") {
      setTask("resume");
      startResume();
      return;
    }

    if (cmd === "/handoff") {
      const handoff = renderLatestWorkspaceHandoff();
      runSetters.setStatus(handoff.split("\n")[0] ?? "No handoff found.");
      eventBus.emit("output", `\n${handoff}\n`);
      return;
    }

    if (cmd === "/sessions") {
      const sessions = listRecentWorkspaceSessions(8);
      if (sessions.length === 0) {
        runSetters.setStatus("No .giraffe sessions found yet.");
        return;
      }

      eventBus.emit(
        "output",
        `\nRecent .giraffe sessions:\n${sessions
          .map((session) => `- ${session.sessionId}`)
          .join("\n")}\n`
      );
      runSetters.setStatus(`Listed ${sessions.length} recent sessions.`);
      return;
    }

    if (cmd === "/agents") {
      runSetters.setStatus(`Available agents: ${Object.keys(getConfig().agents).join(", ")}`);
      return;
    }

    if (cmd === "/mode") {
      const suffix = mode === "delegate" ? ` (${delegateAgent})` : "";
      runSetters.setStatus(`Current mode: ${mode}${suffix}. Use /mode orchestrate | chat | delegate [agent]`);
      return;
    }

    if (cmd.startsWith("/mode ")) {
      const [, rawMode = "", rawAgent = ""] = parseInlineArgs(cmd);
      const requestedMode = rawMode.toLowerCase();
      const knownAgents = Object.keys(getConfig().agents);

      if (["orchestrate", "auto"].includes(requestedMode)) {
        setMode("orchestrate");
        persistWorkspaceMode("orchestrate", delegateAgent);
        runSetters.setStatus("Mode switched to orchestrate.");
        return;
      }

      if (["chat", "giraffe", "reply"].includes(requestedMode)) {
        setMode("chat");
        persistWorkspaceMode("chat", delegateAgent);
        runSetters.setStatus("Mode switched to chat. Giraffe will answer directly.");
        return;
      }

      if (requestedMode === "delegate") {
        const nextAgent = rawAgent || delegateAgent;
        if (!knownAgents.includes(nextAgent)) {
          runSetters.setStatus(`Unknown delegate agent: ${nextAgent}. Try /agents.`);
          return;
        }

        setMode("delegate");
        setDelegateAgent(nextAgent);
        persistWorkspaceMode("delegate", nextAgent);
        runSetters.setStatus(`Mode switched to delegate (${nextAgent}).`);
        return;
      }

      runSetters.setStatus("Unknown mode. Use /mode orchestrate | chat | delegate [agent]");
      return;
    }

    if (cmd === "/delegate") {
      runSetters.setStatus("Usage: /delegate <agent> <task>");
      return;
    }

    if (cmd.startsWith("/delegate ")) {
      const parts = parseInlineArgs(cmd);
      const agentKey = parts[1] ?? "";
      const taskToRun = parts.slice(2).join(" ").trim();
      const knownAgents = Object.keys(getConfig().agents);

      if (!knownAgents.includes(agentKey)) {
        runSetters.setStatus(`Unknown agent: ${agentKey || "(missing)"}. Try /agents.`);
        return;
      }

      if (!taskToRun) {
        runSetters.setStatus("Usage: /delegate <agent> <task>");
        return;
      }

      setTask(taskToRun);
      startDelegate(agentKey, taskToRun);
    }
  };
}
