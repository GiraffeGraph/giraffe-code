import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

const SLASH_COMMANDS = [
  { cmd: "/login",  hint: "authenticate with a provider" },
  { cmd: "/logout", hint: "remove saved credentials" },
  { cmd: "/model",  hint: "choose planner model" },
  { cmd: "/status", hint: "show auth & config status" },
];

interface InputBoxProps {
  onSubmit: (task: string) => void;
  onCommand: (cmd: string) => void;
}

export function InputBox({ onSubmit, onCommand }: InputBoxProps): React.ReactElement {
  const [value, setValue] = useState("");

  const isSlash = value.startsWith("/");
  const matches = isSlash
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(value.toLowerCase()))
    : [];

  useInput((input, key) => {
    if (key.return) {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("/")) {
        // Check for exact or unambiguous match
        const exact = SLASH_COMMANDS.find((c) => c.cmd === trimmed.toLowerCase());
        const match = exact ?? (matches.length === 1 ? matches[0] : undefined);
        if (match) {
          setValue("");
          onCommand(match.cmd);
        }
        // Else: unknown command — do nothing (stays in input)
      } else {
        onSubmit(trimmed);
      }
      return;
    }

    if (key.tab && matches.length === 1 && matches[0]) {
      setValue(matches[0].cmd);
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
      <Text bold color="yellow">
        🦒 GIRAFFE CODE — Interactive Mode
      </Text>
      <Box marginTop={1}>
        <Text bold>Enter task: </Text>
        <Text color={isSlash ? "yellow" : "green"}>{value}</Text>
        <Text color="gray">█</Text>
      </Box>

      {/* Slash command autocomplete */}
      {isSlash && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          {matches.length > 0 ? (
            matches.map((c) => (
              <Box key={c.cmd}>
                <Text color="yellow">{c.cmd.padEnd(12)}</Text>
                <Text dimColor>{c.hint}</Text>
              </Box>
            ))
          ) : (
            <Text dimColor>Unknown command. Try /login, /model, /status, /logout</Text>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          Enter to start   Tab to complete   /command for tools   Q quit
        </Text>
      </Box>
    </Box>
  );
}
