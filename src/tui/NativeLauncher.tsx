import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { getConfig } from "../config/loader.js";

interface NativeLauncherProps {
  onLaunch: (args: string[]) => void;
  onCancel: () => void;
}

type Phase = "agent" | "task";

export function NativeLauncher({ onLaunch, onCancel }: NativeLauncherProps): React.ReactElement {
  const config = getConfig();
  const agents = useMemo(() => Object.entries(config.agents), [config]);

  const defaultIndex = Math.max(
    0,
    agents.findIndex(([key]) => key === "claude")
  );

  const [phase, setPhase] = useState<Phase>("agent");
  const [cursor, setCursor] = useState(defaultIndex);
  const [task, setTask] = useState("");

  const selected = agents[cursor]?.[0] ?? agents[0]?.[0] ?? "claude";

  useInput((input, key) => {
    if (phase === "agent") {
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(agents.length - 1, c + 1));
        return;
      }
      if (key.return) {
        setPhase("task");
        return;
      }
      if (key.escape || input === "q" || (key.ctrl && input === "c")) {
        onCancel();
      }
      return;
    }

    if (key.return) {
      const args = [selected];
      const trimmed = task.trim();
      if (trimmed) args.push(trimmed);
      onLaunch(args);
      return;
    }

    if (key.escape) {
      setPhase("agent");
      return;
    }

    if (key.backspace || key.delete) {
      setTask((prev) => prev.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setTask((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="yellow">🦒 Native Mode Launcher</Text>
      <Box height={1} />

      {phase === "agent" ? (
        <Box flexDirection="column">
          <Text>Select an agent (real native UI):</Text>
          <Box height={1} />
          {agents.map(([key, agent], i) => (
            <Box key={key}>
              <Text color={i === cursor ? "yellow" : "white"}>
                {i === cursor ? "🦒 " : "   "}
                {key.padEnd(10)}
              </Text>
              <Text dimColor>{agent.name}</Text>
            </Box>
          ))}
          <Box height={1} />
          <Text dimColor>↑↓ move   Enter select   Esc/Q cancel</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text>
            Agent: <Text color="yellow">{selected}</Text>
          </Text>
          <Box height={1} />
          <Box>
            <Text>Task (optional): </Text>
            <Text color="green">{task}</Text>
            <Text color="gray">█</Text>
          </Box>
          <Box height={1} />
          <Text dimColor>
            Enter launch native UI   Esc back to agent selection
          </Text>
        </Box>
      )}
    </Box>
  );
}
