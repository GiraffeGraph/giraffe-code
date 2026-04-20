import React from "react";
import { Box, Text } from "ink";
import type { TaskStep } from "../../types/config.js";

interface TaskTreeProps {
  plan: TaskStep[];
}

function statusIcon(status: TaskStep["status"]): string {
  const icons: Record<TaskStep["status"], string> = {
    pending: "○",
    running: "▶",
    done: "✓",
    failed: "✗",
  };
  return icons[status] ?? "○";
}

function statusColor(
  status: TaskStep["status"]
): "gray" | "yellow" | "green" | "red" {
  const colors: Record<TaskStep["status"], "gray" | "yellow" | "green" | "red"> = {
    pending: "gray",
    running: "yellow",
    done: "green",
    failed: "red",
  };
  return colors[status] ?? "gray";
}

function compact(text: string, max = 32): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function TaskTree({ plan }: TaskTreeProps): React.ReactElement {
  const doneCount = plan.filter((step) => step.status === "done").length;
  const failedCount = plan.filter((step) => step.status === "failed").length;
  const running = plan.find((step) => step.status === "running");

  return (
    <Box
      flexDirection="column"
      width={40}
      borderStyle="round"
      borderColor="yellow"
      paddingLeft={1}
      paddingRight={1}
    >
      <Text bold color="yellow">🦒 TASK PLAN</Text>
      <Text dimColor>
        {plan.length === 0
          ? "planning…"
          : `${doneCount}/${plan.length} done${failedCount ? ` • ${failedCount} failed` : ""}`}
      </Text>
      <Box height={1} />

      {plan.length === 0 ? (
        <Box flexDirection="column">
          <Text dimColor>Giraffe is chewing on the task.</Text>
          <Text dimColor>Workers will appear here in planned order.</Text>
        </Box>
      ) : (
        plan.map((step, i) => {
          const isRunning = step.status === "running";
          const isNext = !running && step.status === "pending" && i === doneCount + failedCount;

          return (
            <Box key={`${step.agent}-${i}`} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={statusColor(step.status)}>
                  {statusIcon(step.status)}{" "}
                </Text>
                <Text bold color={isRunning ? "yellow" : step.status === "failed" ? "red" : "white"}>
                  {i + 1}. {step.agent}
                </Text>
                {isNext && <Text dimColor>  next</Text>}
              </Box>
              <Box paddingLeft={2} flexDirection="column">
                <Text dimColor wrap="truncate">{compact(step.instruction)}</Text>
                {step.retried && <Text color="yellow">fallback/retry used</Text>}
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );
}
