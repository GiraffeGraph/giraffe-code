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
import { eventBus } from "../core/eventBus.js";
import { runGraph } from "../core/GiraffeGraph.js";
import { runNativeAgentSession } from "../core/nativeMode.js";
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

interface AppProps {
  initialTask: string;
  needsLogin: boolean;
}

// Parse "Provider API error (500): {"error":{"message":"..."}}}" → clean string
function parseApiError(msg: string): string {
  const jsonMatch = msg.match(/:\s*(\{[\s\S]*\})\s*$/);
  if (!jsonMatch) return msg;
  try {
    const parsed = JSON.parse(jsonMatch[1] ?? "") as {
      error?: { message?: string };
    };
    const apiMsg = parsed?.error?.message;
    if (apiMsg) return msg.replace(jsonMatch[0], `: ${apiMsg}`);
  } catch { /* use original */ }
  return msg;
}

export function App({ initialTask, needsLogin }: AppProps): React.ReactElement {
  const [screen, setScreen] = useState<AppScreen>(
    needsLogin ? "login" : initialTask ? "running" : "input"
  );
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

  const startGraph = useCallback((taskToRun: string) => {
    setScreen("running");
    setStatus("Analyzing task...");
    setOutputLines([]);
    setTaskPlan([]);
    setCurrentAgent("—");

    runGraph(taskToRun)
      .then(() => { eventBus.emit("done"); })
      .catch((err: Error) => { eventBus.emit("error", err.message); });
  }, []);

  const launchNative = useCallback((args: string[]) => {
    setStatus("Launching native agent UI...");

    try {
      // Clear current Ink frame before handing terminal to agent UI.
      process.stdout.write("\x1Bc");
      const code = runNativeAgentSession(args);
      setStatus(
        code === 0
          ? "Native session ended. Enter a task to begin"
          : `Native session exited with code ${code}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Native mode error: ${message}`);
    }

    setCurrentAgent("—");
    setStepInfo("");
    setScreen("input");
  }, []);

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
      const args = cmd.trim().split(/\s+/).slice(1);
      launchNative(args);
    }
  }, [launchNative]);

  const returnToInput = useCallback(() => {
    setScreen("input");
    setStatus("Enter a task to begin");
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
        setStepInfo(total > 0 ? `Step ${done + 1} of ${total}` : "");
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
      setScreen("input");
    };

    const handleDone = (): void => {
      setStatus("All tasks complete!");
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

  // q quits ONLY in running mode — never intercept it while InputBox is active
  useInput((input, key) => {
    if (key.ctrl && input === "c") process.exit(0);
    if (screen === "running" && input === "q") process.exit(0);
  });

  const rows = process.stdout.rows ?? 40;

  // ── Login ─────────────────────────────────────────────────────────────────
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

  // ── Model selector ────────────────────────────────────────────────────────
  if (screen === "model") {
    return (
      <Box flexDirection="column" height={rows}>
        <ModelSelector onComplete={returnToInput} />
      </Box>
    );
  }

  // ── Status ────────────────────────────────────────────────────────────────
  if (screen === "status") {
    return (
      <Box flexDirection="column" height={rows}>
        <StatusScreen onDone={returnToInput} />
      </Box>
    );
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  if (screen === "logout") {
    return (
      <Box flexDirection="column" height={rows}>
        <LogoutSelector onComplete={returnToInput} />
      </Box>
    );
  }

  // ── Doctor ────────────────────────────────────────────────────────────────
  if (screen === "doctor") {
    return (
      <Box flexDirection="column" height={rows}>
        <DoctorScreen onDone={returnToInput} />
      </Box>
    );
  }

  // ── Native launcher ───────────────────────────────────────────────────────
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

  // ── Task input (interactive mode) ─────────────────────────────────────────
  if (screen === "input") {
    return (
      <Box flexDirection="column" height={rows}>
        <GiraffeHeader />
        <Box flexGrow={1}>
          <InputBox
            onSubmit={(t) => { setTask(t); startGraph(t); }}
            onCommand={handleCommand}
            lastStatus={status}
          />
        </Box>
        <StatusBar currentAgent={currentAgent} status={status} stepInfo={stepInfo} />
      </Box>
    );
  }

  // ── Orchestration (running) ───────────────────────────────────────────────
  return (
    <Box flexDirection="column" height={rows}>
      <Box flexGrow={1}>
        <TaskTree plan={taskPlan} />
        <AgentPanel
          lines={outputLines}
          currentAgent={currentAgent !== "—" ? currentAgent : undefined}
        />
      </Box>
      <StatusBar currentAgent={currentAgent} status={status} stepInfo={stepInfo} />
      <Box paddingLeft={1}>
        <Text dimColor>Q quit   Ctrl+C force quit</Text>
      </Box>
    </Box>
  );
}
