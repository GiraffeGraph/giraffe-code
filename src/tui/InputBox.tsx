import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

const SLASH_COMMANDS = [
  { cmd: "/login",  hint: "authenticate with a provider" },
  { cmd: "/logout", hint: "remove saved credentials" },
  { cmd: "/model",  hint: "choose planner model" },
  { cmd: "/status", hint: "show auth & config status" },
  { cmd: "/doctor", hint: "run health checks" },
];

interface InputBoxProps {
  onSubmit: (task: string) => void;
  onCommand: (cmd: string) => void;
  lastStatus?: string;
}

export function InputBox({ onSubmit, onCommand, lastStatus }: InputBoxProps): React.ReactElement {
  const [value, setValue] = useState("");

  const isSlash = value.startsWith("/");
  const matches = isSlash
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(value.toLowerCase()))
    : [];
  const isError = lastStatus?.startsWith("Error:") || lastStatus?.includes("error") || lastStatus?.includes("→");

  useInput((input, key) => {
    if (key.return) {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("/")) {
        const exact = SLASH_COMMANDS.find((c) => c.cmd === trimmed.toLowerCase());
        const match = exact ?? (matches.length === 1 ? matches[0] : undefined);
        if (match) {
          setValue("");
          onCommand(match.cmd);
        }
        // Unknown command: stay, let user see the no-match state
      } else {
        onSubmit(trimmed);
      }
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

      {/* Show last error with fix hint */}
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

      {/* Slash command autocomplete */}
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
            <Text color="red">Unknown command. Available: /login /logout /model /status /doctor</Text>
          )}
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>/ for commands   Tab autocomplete   Esc clear   Ctrl+C quit</Text>
        </Box>
      )}
    </Box>
  );
}
