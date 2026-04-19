import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  currentAgent: string;
  status: string;
  stepInfo: string;
}

const GIRAFFE_MESSAGES: Record<string, string> = {
  claude: "🦒 claude is chewing on your code...",
  codex: "🦒 codex is stretching its long neck into the codebase...",
  gemini: "🦒 gemini is grazing through the docs...",
  pi: "🦒 pi is spotting bugs from a high altitude...",
};

export function StatusBar({
  currentAgent,
  status,
  stepInfo,
}: StatusBarProps): React.ReactElement {
  const giraffeStatus =
    GIRAFFE_MESSAGES[currentAgent.toLowerCase()] ?? status;

  return (
    <Box borderStyle="round" borderColor="yellow" paddingLeft={1} paddingRight={1}>
      <Text bold color="yellow">
        🦒{" "}
      </Text>
      <Text color="yellow" bold>
        {currentAgent !== "—" ? giraffeStatus : status}
      </Text>
      {stepInfo && (
        <>
          <Text dimColor>  </Text>
          <Text color="yellow" dimColor>
            [{stepInfo}]
          </Text>
        </>
      )}
      <Text dimColor>    [/native: real UI]   [Q: quit]</Text>
    </Box>
  );
}
