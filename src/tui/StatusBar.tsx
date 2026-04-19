import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  currentAgent: string;
  status: string;
  stepInfo: string;
}

export function StatusBar({
  currentAgent,
  status,
  stepInfo,
}: StatusBarProps): React.ReactElement {
  return (
    <Box borderStyle="single" paddingLeft={1} paddingRight={1}>
      <Text bold color="cyan">
        STATUS:{" "}
      </Text>
      <Text>{currentAgent}</Text>
      <Text dimColor> — </Text>
      <Text>{status}</Text>
      {stepInfo && (
        <>
          <Text dimColor>  </Text>
          <Text dimColor>{stepInfo}</Text>
        </>
      )}
      <Text dimColor>    [Q: Quit]</Text>
    </Box>
  );
}
