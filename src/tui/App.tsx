import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { TaskTree } from "./TaskTree.js";
import { AgentPanel } from "./AgentPanel.js";
import { StatusBar } from "./StatusBar.js";
import { InputBox } from "./InputBox.js";
import { eventBus } from "../core/eventBus.js";
import { runGraph } from "../core/GiraffeGraph.js";
import type { TaskStep } from "../types/config.js";

interface AppProps {
  initialTask: string;
}

export function App({ initialTask }: AppProps): React.ReactElement {
  const [task, setTask] = useState(initialTask);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [taskPlan, setTaskPlan] = useState<TaskStep[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string>("—");
  const [status, setStatus] = useState<string>(
    initialTask ? "Initializing planner..." : "Enter a task to begin"
  );
  const [stepInfo, setStepInfo] = useState<string>("");
  const [running, setRunning] = useState(false);

  const startGraph = useCallback((taskToRun: string) => {
    setRunning(true);
    setStatus("Analyzing task...");
    setOutputLines([]);
    setTaskPlan([]);

    runGraph(taskToRun)
      .then(() => {
        eventBus.emit("done");
      })
      .catch((err: Error) => {
        eventBus.emit("error", err.message);
      });
  }, []);

  useEffect(() => {
    const handleOutput = (chunk: string): void => {
      // Split by newlines so each line is a separate element,
      // preserving ANSI codes within each chunk.
      setOutputLines((prev) => [...prev, chunk]);
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
      setStatus(`Error: ${message}`);
      setRunning(false);
    };

    const handleDone = (): void => {
      setStatus("All tasks complete!");
      setStepInfo("");
      setRunning(false);
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

  // Kick off the graph immediately if a task was provided via CLI
  useEffect(() => {
    if (initialTask && !running) {
      setTask(initialTask);
      startGraph(initialTask);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      process.exit(0);
    }
  });

  const rows = process.stdout.rows ?? 40;

  if (!task && !running) {
    return (
      <Box flexDirection="column" height={rows}>
        <Box flexGrow={1}>
          <InputBox
            onSubmit={(t) => {
              setTask(t);
              startGraph(t);
            }}
          />
        </Box>
        <StatusBar
          currentAgent={currentAgent}
          status={status}
          stepInfo={stepInfo}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={rows}>
      <Box flexGrow={1}>
        <TaskTree plan={taskPlan} />
        <AgentPanel lines={outputLines} />
      </Box>
      <StatusBar
        currentAgent={currentAgent}
        status={status}
        stepInfo={stepInfo}
      />
    </Box>
  );
}
