import React, { useCallback, useEffect, useMemo, useState } from "react";
import { runNativeAgentSession } from "../../core/runtime/nativeMode.js";
import { updateWorkspaceConfig } from "../../core/runtime/workspaceRuntime.js";
import { createCommandHandler } from "./createCommandHandler.js";
import {
  resolveDelegateAgent,
  resolveInteractiveMode,
  type AppScreen,
  type InteractiveMode,
} from "./controllerShared.js";
import { createRunActions } from "./createRunActions.js";
import { useAppEvents } from "./useAppEvents.js";
import { useWorkspaceSnapshot } from "./useWorkspaceSnapshot.js";
import { useAppShortcuts } from "./useAppShortcuts.js";
import type { TaskStep } from "../../types/config.js";

interface UseAppControllerProps {
  initialTask: string;
  needsLogin: boolean;
}

export function useAppController({
  initialTask,
  needsLogin,
}: UseAppControllerProps) {
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

  const runSetters = useMemo(() => ({
    setScreen,
    setStatus,
    setOutputLines,
    setTaskPlan,
    setCurrentAgent,
    setStepInfo,
    setIsBusy,
  }), []);

  const persistWorkspaceMode = useCallback((nextMode: InteractiveMode, nextDelegateAgent?: string) => {
    updateWorkspaceConfig({
      defaultMode: nextMode,
      ...(nextDelegateAgent ? { defaultDelegateAgent: nextDelegateAgent } : {}),
    });
  }, []);

  const returnToInput = useCallback(() => {
    setScreen("input");
    setStatus("Enter a task to begin");
    setCurrentAgent("—");
    setStepInfo("");
    setIsBusy(false);
  }, []);

  const { startGraph, startDelegate, startChat, startResume } = useMemo(
    () => createRunActions({ runSetters }),
    [runSetters]
  );

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

    if (mode === "chat") return startChat(nextTask);
    if (mode === "delegate") return startDelegate(delegateAgent, nextTask);
    return startGraph(nextTask);
  }, [delegateAgent, mode, startChat, startDelegate, startGraph]);

  const handleCommand = useMemo(() => createCommandHandler({
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
  }), [
    delegateAgent,
    launchNative,
    mode,
    persistWorkspaceMode,
    runSetters,
    startDelegate,
    startGraph,
    startResume,
  ]);

  useAppEvents(runSetters);

  useEffect(() => {
    if (!needsLogin && initialTask) {
      startGraph(initialTask);
    }
  }, [initialTask, needsLogin, startGraph]);

  useAppShortcuts({ screen, isBusy, returnToInput });

  const rows = process.stdout.rows ?? 40;
  const columns = process.stdout.columns ?? 120;
  const inputPaneWidth = Math.max(52, Math.floor(columns * 0.52));
  const { agents, latestHandoff, recentSessions } = useWorkspaceSnapshot(outputLines.length, status);

  const handleLoginComplete = useCallback(() => {
    if (task) startGraph(task);
    else returnToInput();
  }, [returnToInput, startGraph, task]);

  return {
    screen,
    mode,
    delegateAgent,
    outputLines,
    taskPlan,
    currentAgent,
    status,
    stepInfo,
    isBusy,
    rows,
    inputPaneWidth,
    agents,
    latestHandoff,
    recentSessions,
    handleSubmit,
    handleCommand,
    returnToInput,
    launchNative,
    handleLoginComplete,
  };
}
