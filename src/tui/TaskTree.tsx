import React from "react";
import { Box, Text } from "ink";
import type { TaskStep } from "../types/config.js";

interface TaskTreeProps {
  plan: TaskStep[];
}

function statusIcon(status: TaskStep["status"]): string {
  const icons: Record<TaskStep["status"], string> = {
    pending: "○",
    running: "🦒",
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

export function TaskTree({ plan }: TaskTreeProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      width={32}
      borderStyle="round"
      borderColor="yellow"
      paddingLeft={1}
      paddingRight={1}
    >
      <Text bold color="yellow">
        🦒 TASK PLAN
      </Text>
      <Box height={1} />
      {plan.length === 0 ? (
        <Text dimColor>chewing on the task...</Text>
      ) : (
        plan.map((step, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={statusColor(step.status)}>
                {statusIcon(step.status)}{" "}
              </Text>
              <Text bold color={step.status === "running" ? "yellow" : "white"}>
                {i + 1}. {step.agent}
              </Text>
            </Box>
            <Box paddingLeft={2}>
              <Text dimColor wrap="truncate">
                {step.instruction.length > 26
                  ? step.instruction.slice(0, 26) + "…"
                  : step.instruction}
              </Text>
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
}
