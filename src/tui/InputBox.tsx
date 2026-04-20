import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

type InteractiveMode = "orchestrate" | "chat" | "delegate";

const SLASH_COMMANDS = [
  { cmd: "/login", hint: "authenticate with a provider" },
  { cmd: "/logout", hint: "remove saved credentials" },
  { cmd: "/model", hint: "choose planner model" },
  { cmd: "/status", hint: "show auth & config status" },
  { cmd: "/doctor", hint: "run health checks" },
  { cmd: "/resume", hint: "resume from .giraffe/handoffs/latest" },
  { cmd: "/handoff", hint: "show latest workspace handoff" },
  { cmd: "/sessions", hint: "list recent workspace sessions" },
  { cmd: "/agents", hint: "list configured agents" },
  { cmd: "/mode", hint: "switch mode: orchestrate | chat | delegate [agent]" },
  { cmd: "/delegate", hint: "run one agent manually: /delegate <agent> <task>" },
  { cmd: "/native", hint: "open native launcher or run /native <agent> <task>" },
  { cmd: "/improve", hint: "dogfood mode: improve this repo (optional focus)" },
];

interface InputBoxProps {
  onSubmit: (task: string) => void;
  onCommand: (cmd: string) => void;
  lastStatus?: string;
  mode: InteractiveMode;
  delegateAgent: string;
}

function modeLabel(mode: InteractiveMode, delegateAgent: string): string {
  if (mode === "delegate") return `delegate:${delegateAgent}`;
  return mode;
}

export function InputBox({
  onSubmit,
  onCommand,
  lastStatus,
  mode,
  delegateAgent,
}: InputBoxProps): React.ReactElement {
  const [value, setValue] = useState("");

  const isSlash = value.startsWith("/");
  const slashToken = isSlash ? value.toLowerCase().trim().split(/\s+/)[0] ?? "" : "";
  const matches = isSlash
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashToken))
    : [];
  const isError = lastStatus?.startsWith("Error:") || lastStatus?.includes("error") || lastStatus?.includes("→");

  useInput((input, key) => {
    if (key.return) {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("/")) {
        const lower = trimmed.toLowerCase();

        if (
          lower === "/native" ||
          lower.startsWith("/native ") ||
          lower === "/improve" ||
          lower.startsWith("/improve ") ||
          lower === "/mode" ||
          lower === "/resume" ||
          lower === "/handoff" ||
          lower === "/sessions" ||
          lower.startsWith("/mode ") ||
          lower.startsWith("/delegate ")
        ) {
          setValue("");
          onCommand(trimmed);
          return;
        }

        const exact = SLASH_COMMANDS.find((c) => c.cmd === lower);
        const match = exact ?? (matches.length === 1 ? matches[0] : undefined);
        if (match) {
          setValue("");
          onCommand(match.cmd);
        }
        return;
      }

      setValue("");
      onSubmit(trimmed);
      return;
    }

    if (key.tab && matches.length === 1 && matches[0]) {
      setValue(matches[0].cmd);
      return;
    }

    if (key.escape) {
      setValue("");
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" paddingLeft={1} paddingTop={1}>
      <Text bold color="yellow">🦒 GIRAFFE CODE — Interactive Mode</Text>
      <Text dimColor>Mode: {modeLabel(mode, delegateAgent)}</Text>

      {isError && lastStatus && (
        <Box marginTop={1}>
          <Text color="red">{lastStatus}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text bold>Enter task: </Text>
        <Text color={isSlash ? "yellow" : "green"}>{value}</Text>
        <Text color="gray">█</Text>
      </Box>

      {isSlash ? (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          {matches.length > 0 ? (
            matches.map((c) => (
              <Box key={c.cmd}>
                <Text color="yellow">{c.cmd.padEnd(12)}</Text>
                <Text dimColor>{c.hint}</Text>
              </Box>
            ))
          ) : (
            <Text color="red">Unknown command. Try /resume /handoff /sessions /mode /delegate</Text>
          )}
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>/ for commands   Tab autocomplete   Esc clear   Ctrl+C quit</Text>
          <Text dimColor>
            Enter will {mode === "chat" ? "ask Giraffe directly" : mode === "delegate" ? `delegate to ${delegateAgent}` : "run orchestration"}
          </Text>
        </Box>
      )}
    </Box>
  );
}
