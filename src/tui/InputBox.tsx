import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface InputBoxProps {
  onSubmit: (task: string) => void;
}

export function InputBox({ onSubmit }: InputBoxProps): React.ReactElement {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (key.return) {
      const trimmed = value.trim();
      if (trimmed) {
        onSubmit(trimmed);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    // Ignore non-printable control characters
    if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" paddingLeft={1} paddingTop={1}>
      <Text bold color="cyan">
        🦒 GIRAFFE CODE — Interactive Mode
      </Text>
      <Box marginTop={1}>
        <Text bold>Enter task: </Text>
        <Text color="green">{value}</Text>
        <Text color="gray">█</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Enter to start   [Q: Quit]</Text>
      </Box>
    </Box>
  );
}
