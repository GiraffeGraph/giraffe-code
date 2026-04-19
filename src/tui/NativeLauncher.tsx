import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { getConfig } from "../config/loader.js";
import { getUserConfig, setUserConfig } from "../config/userConfig.js";

interface NativeLauncherProps {
  onLaunch: (args: string[]) => void;
  onCancel: () => void;
}

type Phase = "agent" | "task";

const DEFAULT_TASK_PRESETS = [
  "scan this repo and suggest a concrete refactor plan",
  "fix failing tests and explain root cause",
  "improve DX/UX and keep behavior backward compatible",
  "review latest changes and list high-risk issues first",
] as const;

function normalizeTasks(tasks: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tasks) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result.slice(0, 9);
}

function mergeWithDefaultTasks(savedTasks: string[]): string[] {
  return normalizeTasks([...savedTasks, ...DEFAULT_TASK_PRESETS]);
}

export function NativeLauncher({ onLaunch, onCancel }: NativeLauncherProps): React.ReactElement {
  const config = getConfig();
  const userConfig = getUserConfig();

  const agents = useMemo(() => Object.entries(config.agents), [config]);

  const [defaultAgent, setDefaultAgent] = useState<string | undefined>(
    userConfig.native?.defaultAgent
  );

  const preferredAgent = defaultAgent;
  const defaultIndex = Math.max(
    0,
    agents.findIndex(([key]) => key === preferredAgent || key === "claude")
  );

  const [customPresets, setCustomPresets] = useState<string[]>(
    normalizeTasks(userConfig.native?.savedTasks ?? [])
  );

  const presets = useMemo(
    () => mergeWithDefaultTasks(customPresets),
    [customPresets]
  );

  const [phase, setPhase] = useState<Phase>("agent");
  const [cursor, setCursor] = useState(defaultIndex);
  const [task, setTask] = useState(userConfig.native?.lastTask ?? "");
  const [presetCursor, setPresetCursor] = useState(0);
  const [hint, setHint] = useState<string>(
    userConfig.native?.defaultAgent
      ? `Default native agent: ${userConfig.native.defaultAgent}`
      : "Tip: press D on an agent to save it as default"
  );

  const selected = agents[cursor]?.[0] ?? agents[0]?.[0] ?? "claude";

  const persistNative = (next: {
    defaultAgent?: string;
    lastTask?: string;
    savedTasks?: string[];
  }): void => {
    const current = getUserConfig();
    setUserConfig({
      ...current,
      native: {
        ...(current.native ?? {}),
        ...next,
      },
    });
  };

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
      if (input.toLowerCase() === "d") {
        persistNative({ defaultAgent: selected });
        setDefaultAgent(selected);
        setHint(`Saved default native agent: ${selected}`);
        return;
      }
      if (key.escape || input === "q" || (key.ctrl && input === "c")) {
        onCancel();
      }
      return;
    }

    // task phase
    if (key.return) {
      const trimmed = task.trim();
      const args = [selected];
      if (trimmed) args.push(trimmed);

      const nextCustomPresets = trimmed
        ? normalizeTasks([trimmed, ...customPresets])
        : customPresets;

      persistNative({
        defaultAgent: selected,
        lastTask: trimmed,
        savedTasks: nextCustomPresets,
      });
      setDefaultAgent(selected);
      setCustomPresets(nextCustomPresets);

      onLaunch(args);
      return;
    }

    if (key.escape) {
      setPhase("agent");
      return;
    }

    if (key.upArrow) {
      setPresetCursor((c) => Math.max(0, c - 1));
      return;
    }

    if (key.downArrow) {
      setPresetCursor((c) => Math.min(presets.length - 1, c + 1));
      return;
    }

    if (key.tab && presets[presetCursor]) {
      setTask(presets[presetCursor]);
      return;
    }

    const digit = Number(input);
    if (Number.isInteger(digit) && digit >= 1 && digit <= presets.length) {
      setTask(presets[digit - 1] ?? task);
      setPresetCursor(digit - 1);
      return;
    }

    if (key.ctrl && input.toLowerCase() === "l") {
      setTask("");
      return;
    }

    if (input.toLowerCase() === "s") {
      const trimmed = task.trim();
      if (!trimmed) {
        setHint("Task empty: write something before saving");
        return;
      }

      const nextCustomPresets = normalizeTasks([trimmed, ...customPresets]);
      persistNative({ savedTasks: nextCustomPresets, lastTask: trimmed });
      setCustomPresets(nextCustomPresets);
      setHint("Saved task preset");
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
      <Text dimColor>{hint}</Text>
      <Box height={1} />

      {phase === "agent" ? (
        <Box flexDirection="column">
          <Text>Select an agent (real native UI):</Text>
          <Box height={1} />
          {agents.map(([key, agent], i) => {
            const isDefault = key === defaultAgent;
            return (
              <Box key={key}>
                <Text color={i === cursor ? "yellow" : "white"}>
                  {i === cursor ? "🦒 " : "   "}
                  {key.padEnd(10)}
                </Text>
                <Text dimColor>
                  {agent.name}
                  {isDefault ? "  (default)" : ""}
                </Text>
              </Box>
            );
          })}
          <Box height={1} />
          <Text dimColor>↑↓ move   Enter select   D set default   Esc/Q cancel</Text>
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

          <Text dimColor>Quick presets (↑↓ + Tab or 1..9):</Text>
          {presets.map((preset, i) => (
            <Text key={preset} color={i === presetCursor ? "yellow" : "gray"}>
              {i + 1}. {preset}
            </Text>
          ))}

          <Box height={1} />
          <Text dimColor>
            Enter launch   S save preset   Ctrl+L clear   Esc back
          </Text>
        </Box>
      )}
    </Box>
  );
}
