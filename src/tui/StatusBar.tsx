import React from "react";
import { Box, Text } from "ink";

type InteractiveMode = "orchestrate" | "chat" | "delegate";

interface StatusBarProps {
  currentAgent: string;
  status: string;
  stepInfo: string;
  mode: InteractiveMode;
  delegateAgent: string;
  isBusy: boolean;
}

const GIRAFFE_MESSAGES: Record<string, string> = {
  claude: "🦒 claude is chewing on your code...",
  codex: "🦒 codex is stretching its long neck into the codebase...",
  gemini: "🦒 gemini is grazing through the docs...",
  pi: "🦒 pi is spotting bugs from a high altitude...",
  giraffe: "🦒 giraffe is thinking and replying directly...",
};

function formatMode(mode: InteractiveMode, delegateAgent: string): string {
  if (mode === "delegate") return `delegate:${delegateAgent}`;
  return mode;
}

export function StatusBar({
  currentAgent,
  status,
  stepInfo,
  mode,
  delegateAgent,
  isBusy,
}: StatusBarProps): React.ReactElement {
  const giraffeStatus =
    isBusy && currentAgent !== "—"
      ? (GIRAFFE_MESSAGES[currentAgent.toLowerCase()] ?? status)
      : status;

  return (
    <Box borderStyle="round" borderColor="yellow" paddingLeft={1} paddingRight={1}>
      <Text bold color="yellow">🦒 </Text>
      <Text color="yellow" bold>
        {giraffeStatus}
      </Text>
      {stepInfo && (
        <>
          <Text dimColor>  </Text>
          <Text color="yellow" dimColor>
            [{stepInfo}]
          </Text>
        </>
      )}
      <Text dimColor>    [mode: {formatMode(mode, delegateAgent)}]</Text>
      <Text dimColor>
        {isBusy
          ? "   [/delegate] [/native] [Q: quit]"
          : "   [/mode] [/delegate] [/agents] [/native]"}
      </Text>
    </Box>
  );
}
