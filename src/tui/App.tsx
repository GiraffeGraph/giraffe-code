import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { TaskTree } from "./TaskTree.js";
import { AgentPanel } from "./AgentPanel.js";
import { StatusBar } from "./StatusBar.js";
import { InputBox } from "./InputBox.js";
import { GiraffeHeader } from "./GiraffeHeader.js";
import { LoginSelector } from "./LoginSelector.js";
import { ModelSelector } from "./ModelSelector.js";
import { StatusScreen } from "./StatusScreen.js";
import { LogoutSelector } from "./LogoutSelector.js";
import { DoctorScreen } from "./DoctorScreen.js";
import { NativeLauncher } from "./NativeLauncher.js";
import { getConfig } from "../config/loader.js";
import { eventBus } from "../core/eventBus.js";
import { runGraph } from "../core/GiraffeGraph.js";
import { runNativeAgentSession } from "../core/nativeMode.js";
import { buildSelfImproveTask } from "../core/improvePrompt.js";
import { runChatReply, runDelegateTask, runResumeTask } from "../core/runModes.js";
import {
  getWorkspaceConfig,
  renderLatestWorkspaceHandoff,
  listRecentWorkspaceSessions,
  updateWorkspaceConfig,
} from "../core/workspaceRuntime.js";
import type { TaskStep } from "../types/config.js";

type AppScreen =
  | "login"
  | "input"
  | "running"
  | "model"
  | "status"
  | "logout"
  | "doctor"
  | "native_launcher";

type InteractiveMode = "orchestrate" | "chat" | "delegate";

interface AppProps {
  initialTask: string;
  needsLogin: boolean;
}

function parseApiError(msg: string): string {
  const jsonMatch = msg.match(/:\s*(\{[\s\S]*\})\s*$/);
  if (!jsonMatch) return msg;
  try {
    const parsed = JSON.parse(jsonMatch[1] ?? "") as {
      error?: { message?: string };
    };
    const apiMsg = parsed?.error?.message;
    if (apiMsg) return msg.replace(jsonMatch[0], `: ${apiMsg}`);
  } catch {
    // use original
  }
  return msg;
}

function parseInlineArgs(input: string): string[] {
  const result: string[] = [];
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^\s]+)/g;

  for (const match of input.matchAll(regex)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    result.push(value.replace(/\\(["'\\])/g, "$1"));
  }

  return result;
}

function resolveInteractiveMode(): InteractiveMode {
  const saved = getWorkspaceConfig().defaultMode;
  if (saved === "chat" || saved === "delegate") return saved;
  return "orchestrate";
}

function resolveDelegateAgent(): string {
  const config = getConfig();
  const knownAgents = Object.keys(config.agents);
  const saved = getWorkspaceConfig().defaultDelegateAgent;

  if (saved && knownAgents.includes(saved)) return saved;
  if (knownAgents.includes("claude")) return "claude";
  return knownAgents[0] ?? "claude";
}

export function App({ initialTask, needsLogin }: AppProps): React.ReactElement {
  const [screen, setScreen] = useState<AppScreen>(
    needsLogin ? "login" : initialTask ? "running" : "input"
  );
  const [mode, setMode] = useState<InteractiveMode>(resolveInteractiveMode);
  const [delegateAgent, setDelegateAgent] = useState<string>(resolveDelegateAgent);
  const [task, setTask] = useState(initialTask);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [taskPlan, setTaskPlan] = useState<TaskStep[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string>("—");
  const [status, setStatus] = useState<string>(
    needsLogin
      ? "Login required"
      : initialTask
        ? "Initializing planner..."
        : "Enter a task to begin"
  );
  const [stepInfo, setStepInfo] = useState<string>("");
  const [isBusy, setIsBusy] = useState<boolean>(Boolean(initialTask));

  const persistWorkspaceMode = useCallback((nextMode: InteractiveMode, nextDelegateAgent?: string) => {
    updateWorkspaceConfig({
      defaultMode: nextMode,
      ...(nextDelegateAgent ? { defaultDelegateAgent: nextDelegateAgent } : {}),
    });
  }, []);

  const startGraph = useCallback((taskToRun: string) => {
    setScreen("running");
    setStatus("Analyzing task...");
    setOutputLines([]);
    setTaskPlan([]);
    setCurrentAgent("—");
    setIsBusy(true);

    runGraph(taskToRun)
      .then(() => { eventBus.emit("done"); })
      .catch((err: Error) => { eventBus.emit("error", err.message); });
  }, []);

  const startDelegate = useCallback((agentKey: string, taskToRun: string) => {
    setScreen("running");
    setStatus(`Delegating directly to ${agentKey}...`);
    setOutputLines([]);
    setTaskPlan([
      {
        agent: agentKey,
        instruction: taskToRun,
        status: "pending",
        requiresSubOrchestration: false,
        retried: false,
      },
    ]);
    setCurrentAgent(agentKey);
    setIsBusy(true);

    runDelegateTask(agentKey, taskToRun)
      .then(() => { eventBus.emit("done"); })
      .catch((err: Error) => { eventBus.emit("error", err.message); });
  }, []);

  const startChat = useCallback((message: string) => {
    setScreen("running");
    setStatus("Giraffe is thinking...");
    setOutputLines([]);
    setTaskPlan([
      {
        agent: "giraffe",
        instruction: message,
        status: "running",
        requiresSubOrchestration: false,
        retried: false,
      },
    ]);
    setCurrentAgent("giraffe");
    setStepInfo("Reply mode");
    setIsBusy(true);

    runChatReply(message)
      .then((reply) => {
        eventBus.emit("output", `\n🦒 ${reply}\n`);
        setTaskPlan([
          {
            agent: "giraffe",
            instruction: message,
            status: "done",
            requiresSubOrchestration: false,
            retried: false,
          },
        ]);
        setStatus("Giraffe replied. Press Enter for a new task.");
        setCurrentAgent("—");
        setIsBusy(false);
      })
      .catch((err: Error) => { eventBus.emit("error", err.message); });
  }, []);

  const launchNative = useCallback((args: string[]) => {
    setStatus("Launching native agent UI...");

    try {
      process.stdout.write("\x1Bc");
      const code = runNativeAgentSession(args);
      setStatus(
        code === 0
          ? "Native session ended. Enter a task to begin"
          : code === 130
            ? "Native session cancelled. Enter a task to begin"
            : `Native session exited with code ${code}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Native mode error: ${message}`);
    }

    setCurrentAgent("—");
    setStepInfo("");
    setIsBusy(false);
    setScreen("input");
  }, []);

  const handleSubmit = useCallback((nextTask: string) => {
    setTask(nextTask);

    if (mode === "chat") {
      startChat(nextTask);
      return;
    }

    if (mode === "delegate") {
      startDelegate(delegateAgent, nextTask);
      return;
    }

    startGraph(nextTask);
  }, [delegateAgent, mode, startChat, startDelegate, startGraph]);

  const handleCommand = useCallback((cmd: string) => {
    if (cmd === "/login") {
      setScreen("login");
      return;
    }

    if (cmd === "/model") {
      setScreen("model");
      return;
    }

    if (cmd === "/status") {
      setScreen("status");
      return;
    }

    if (cmd === "/logout") {
      setScreen("logout");
      return;
    }

    if (cmd === "/doctor") {
      setScreen("doctor");
      return;
    }

    if (cmd === "/native") {
      setScreen("native_launcher");
      return;
    }

    if (cmd.startsWith("/native ")) {
      const args = parseInlineArgs(cmd).slice(1);
      launchNative(args);
      return;
    }

    if (cmd === "/improve") {
      const generated = buildSelfImproveTask();
      setTask(generated);
      startGraph(generated);
      return;
    }

    if (cmd.startsWith("/improve ")) {
      const focus = cmd.slice("/improve".length).trim();
      const generated = buildSelfImproveTask(focus);
      setTask(generated);
      startGraph(generated);
      return;
    }

    if (cmd === "/resume") {
      setTask("resume");
      setScreen("running");
      setStatus("Resuming from latest .giraffe handoff...");
      setOutputLines([]);
      setTaskPlan([]);
      setCurrentAgent("—");
      setStepInfo("");
      setIsBusy(true);

      runResumeTask()
        .then(() => { eventBus.emit("done"); })
        .catch((err: Error) => { eventBus.emit("error", err.message); });
      return;
    }

    if (cmd === "/handoff") {
      setStatus(renderLatestWorkspaceHandoff().split("\n")[0] ?? "No handoff found.");
      eventBus.emit("output", `\n${renderLatestWorkspaceHandoff()}\n`);
      return;
    }

    if (cmd === "/sessions") {
      const sessions = listRecentWorkspaceSessions(8);
      if (sessions.length === 0) {
        setStatus("No .giraffe sessions found yet.");
        return;
      }

      eventBus.emit(
        "output",
        `\nRecent .giraffe sessions:\n${sessions
          .map((session) => `- ${session.sessionId}`)
          .join("\n")}\n`
      );
      setStatus(`Listed ${sessions.length} recent sessions.`);
      return;
    }

    if (cmd === "/agents") {
      const list = Object.keys(getConfig().agents).join(", ");
      setStatus(`Available agents: ${list}`);
      return;
    }

    if (cmd === "/mode") {
      const suffix = mode === "delegate" ? ` (${delegateAgent})` : "";
      setStatus(`Current mode: ${mode}${suffix}. Use /mode orchestrate | chat | delegate [agent]`);
      return;
    }

    if (cmd.startsWith("/mode ")) {
      const [, rawMode = "", rawAgent = ""] = parseInlineArgs(cmd);
      const requestedMode = rawMode.toLowerCase();
      const knownAgents = Object.keys(getConfig().agents);

      if (["orchestrate", "auto"].includes(requestedMode)) {
        setMode("orchestrate");
        persistWorkspaceMode("orchestrate", delegateAgent);
        setStatus("Mode switched to orchestrate.");
        return;
      }

      if (["chat", "giraffe", "reply"].includes(requestedMode)) {
        setMode("chat");
        persistWorkspaceMode("chat", delegateAgent);
        setStatus("Mode switched to chat. Giraffe will answer directly.");
        return;
      }

      if (requestedMode === "delegate") {
        const nextAgent = rawAgent || delegateAgent;
        if (!knownAgents.includes(nextAgent)) {
          setStatus(`Unknown delegate agent: ${nextAgent}. Try /agents.`);
          return;
        }

        setMode("delegate");
        setDelegateAgent(nextAgent);
        persistWorkspaceMode("delegate", nextAgent);
        setStatus(`Mode switched to delegate (${nextAgent}).`);
        return;
      }

      setStatus("Unknown mode. Use /mode orchestrate | chat | delegate [agent]");
      return;
    }

    if (cmd === "/delegate") {
      setStatus("Usage: /delegate <agent> <task>");
      return;
    }

    if (cmd.startsWith("/delegate ")) {
      const parts = parseInlineArgs(cmd);
      const agentKey = parts[1] ?? "";
      const taskParts = parts.slice(2);
      const taskToRun = taskParts.join(" ").trim();
      const knownAgents = Object.keys(getConfig().agents);

      if (!knownAgents.includes(agentKey)) {
        setStatus(`Unknown agent: ${agentKey || "(missing)"}. Try /agents.`);
        return;
      }

      if (!taskToRun) {
        setStatus("Usage: /delegate <agent> <task>");
        return;
      }

      setTask(taskToRun);
      startDelegate(agentKey, taskToRun);
    }
  }, [delegateAgent, launchNative, mode, persistWorkspaceMode, startDelegate, startGraph]);

  const returnToInput = useCallback(() => {
    setScreen("input");
    setStatus("Enter a task to begin");
    setCurrentAgent("—");
    setStepInfo("");
    setIsBusy(false);
  }, []);

  useEffect(() => {
    const handleOutput = (chunk: string): void => {
      setOutputLines((prev) => {
        const next = [...prev, chunk];
        return next.length > 2000 ? next.slice(-2000) : next;
      });
    };

    const handleStateUpdate = (
      state: Parameters<typeof eventBus.emit>[1]
    ): void => {
      if (!state || typeof state !== "object") return;
      const s = state as Record<string, unknown>;

      if (Array.isArray(s["taskPlan"])) {
        const plan = s["taskPlan"] as TaskStep[];
        setTaskPlan(plan);
        const total = plan.length;
        const done = plan.filter(
          (p) => p.status === "done" || p.status === "failed"
        ).length;
        setStepInfo(total > 0 ? `Step ${Math.min(done + 1, total)} of ${total}` : "");
      }

      if (typeof s["currentAgent"] === "string") {
        setCurrentAgent(s["currentAgent"]);
        setStatus(`${s["currentAgent"]} running...`);
      }
    };

    const handleError = (message: string): void => {
      const clean = parseApiError(message);
      const firstLine = clean.split("\n")[0] ?? clean;
      const truncated = firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine;

      const lowered = firstLine.toLowerCase();
      const isSetupIssue =
        lowered.includes("agent cli command not found") ||
        lowered.includes("no runnable agent clis") ||
        lowered.includes("posix_spawnp failed") ||
        lowered.includes("failed to start agent command");

      const hint = isSetupIssue
        ? "/doctor to fix agent setup"
        : "/login or /model to fix";

      setStatus(`${truncated}  →  ${hint}`);
      setCurrentAgent("—");
      setStepInfo("");
      setIsBusy(false);
      setScreen("input");
    };

    const handleDone = (): void => {
      setStatus("All tasks complete! Press Enter for a new task.");
      setCurrentAgent("—");
      setIsBusy(false);
      setStepInfo("");
    };

    eventBus.on("output", handleOutput);
    eventBus.on("stateUpdate", handleStateUpdate);
    eventBus.on("error", handleError);
    eventBus.on("done", handleDone);

    return () => {
      eventBus.off("output", handleOutput);
      eventBus.off("stateUpdate", handleStateUpdate);
      eventBus.off("error", handleError);
      eventBus.off("done", handleDone);
    };
  }, []);

  useEffect(() => {
    if (screen === "running" && task) {
      startGraph(task);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === "c") process.exit(0);
    if (screen === "running" && isBusy && input === "q") process.exit(0);
    if (screen === "running" && !isBusy && key.return) {
      returnToInput();
    }
  });

  const rows = process.stdout.rows ?? 40;

  if (screen === "login") {
    return (
      <Box flexDirection="column" height={rows}>
        <LoginSelector
          onComplete={() => {
            if (task) startGraph(task);
            else returnToInput();
          }}
        />
      </Box>
    );
  }

  if (screen === "model") {
    return (
      <Box flexDirection="column" height={rows}>
        <ModelSelector onComplete={returnToInput} />
      </Box>
    );
  }

  if (screen === "status") {
    return (
      <Box flexDirection="column" height={rows}>
        <StatusScreen onDone={returnToInput} />
      </Box>
    );
  }

  if (screen === "logout") {
    return (
      <Box flexDirection="column" height={rows}>
        <LogoutSelector onComplete={returnToInput} />
      </Box>
    );
  }

  if (screen === "doctor") {
    return (
      <Box flexDirection="column" height={rows}>
        <DoctorScreen onDone={returnToInput} />
      </Box>
    );
  }

  if (screen === "native_launcher") {
    return (
      <Box flexDirection="column" height={rows}>
        <NativeLauncher
          onLaunch={launchNative}
          onCancel={returnToInput}
        />
      </Box>
    );
  }

  if (screen === "input") {
    return (
      <Box flexDirection="column" height={rows}>
        <GiraffeHeader />
        <Box flexGrow={1}>
          <InputBox
            onSubmit={handleSubmit}
            onCommand={handleCommand}
            lastStatus={status}
            mode={mode}
            delegateAgent={delegateAgent}
          />
        </Box>
        <StatusBar
          currentAgent={currentAgent}
          status={status}
          stepInfo={stepInfo}
          mode={mode}
          delegateAgent={delegateAgent}
          isBusy={false}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={rows}>
      <Box flexGrow={1}>
        <TaskTree plan={taskPlan} />
        <AgentPanel
          lines={outputLines}
          currentAgent={currentAgent !== "—" ? currentAgent : undefined}
        />
      </Box>
      <StatusBar
        currentAgent={currentAgent}
        status={status}
        stepInfo={stepInfo}
        mode={mode}
        delegateAgent={delegateAgent}
        isBusy={isBusy}
      />
      <Box paddingLeft={1}>
        <Text dimColor>{isBusy ? "Q quit   Ctrl+C force quit" : "Enter new task   Ctrl+C quit"}</Text>
      </Box>
    </Box>
  );
}
