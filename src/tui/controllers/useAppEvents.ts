import { useEffect } from "react";
import { eventBus } from "../../core/runtime/eventBus.js";
import type { TaskStep } from "../../types/config.js";
import { parseApiError, type RunSetters } from "./controllerShared.js";

function buildErrorStatus(message: string): string {
  const clean = parseApiError(message);
  const firstLine = clean.split("\n")[0] ?? clean;
  const truncated = firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
  const lowered = firstLine.toLowerCase();
  const isSetupIssue =
    lowered.includes("agent cli command not found") ||
    lowered.includes("no runnable agent clis") ||
    lowered.includes("posix_spawnp failed") ||
    lowered.includes("failed to start agent command");
  const hint = isSetupIssue ? "/doctor to fix agent setup" : "/login or /model to fix";

  return `${truncated}  →  ${hint}`;
}

export function useAppEvents(setters: RunSetters): void {
  useEffect(() => {
    const handleOutput = (chunk: string): void => {
      setters.setOutputLines((prev) => {
        const next = [...prev, chunk];
        return next.length > 2000 ? next.slice(-2000) : next;
      });
    };

    const handleStateUpdate = (state: Parameters<typeof eventBus.emit>[1]): void => {
      if (!state || typeof state !== "object") return;
      const s = state as Record<string, unknown>;

      if (Array.isArray(s["taskPlan"])) {
        const plan = s["taskPlan"] as TaskStep[];
        setters.setTaskPlan(plan);
        const total = plan.length;
        const done = plan.filter((p) => p.status === "done" || p.status === "failed").length;
        setters.setStepInfo(total > 0 ? `Step ${Math.min(done + 1, total)} of ${total}` : "");
      }

      if (typeof s["currentAgent"] === "string") {
        setters.setCurrentAgent(s["currentAgent"]);
        setters.setStatus(`${s["currentAgent"]} running...`);
      }
    };

    const handleError = (message: string): void => {
      setters.setStatus(buildErrorStatus(message));
      setters.setCurrentAgent("—");
      setters.setStepInfo("");
      setters.setIsBusy(false);
      setters.setScreen("input");
    };

    const handleDone = (): void => {
      setters.setStatus("All tasks complete! Press Enter for a new task.");
      setters.setCurrentAgent("—");
      setters.setIsBusy(false);
      setters.setStepInfo("");
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
  }, [setters]);
}
