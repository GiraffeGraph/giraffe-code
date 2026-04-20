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
  claude: "claude is coding…",
  codex: "codex is coding…",
  gemini: "gemini is analyzing…",
  pi: "pi is working…",
  opencode: "opencode is iterating…",
  giraffe: "giraffe is replying…",
};

function formatMode(mode: InteractiveMode, delegateAgent: string): string {
  if (mode === "delegate") return `delegate:${delegateAgent}`;
  return mode;
}

function statusColor(status: string): "yellow" | "red" | "green" | "cyan" {
  const lowered = status.toLowerCase();
  if (lowered.includes("error") || lowered.includes("failed")) return "red";
  if (lowered.includes("complete") || lowered.includes("replied")) return "green";
  if (lowered.includes("running") || lowered.includes("thinking") || lowered.includes("delegating")) {
    return "cyan";
  }
  return "yellow";
}

export function StatusBar({
  currentAgent,
  status,
  stepInfo,
  mode,
  delegateAgent,
  isBusy,
}: StatusBarProps): React.ReactElement {
  const effectiveStatus =
    isBusy && currentAgent !== "—"
      ? GIRAFFE_MESSAGES[currentAgent.toLowerCase()] ?? status
      : status;

  return (
    <Box borderStyle="round" borderColor="yellow" paddingLeft={1} paddingRight={1}>
      <Text bold color="yellow">🦒 </Text>
      <Text color={statusColor(effectiveStatus)} bold>
        {effectiveStatus}
      </Text>
      {stepInfo && (
        <>
          <Text dimColor>  </Text>
          <Text dimColor>[{stepInfo}]</Text>
        </>
      )}
      <Text dimColor>  [mode: {formatMode(mode, delegateAgent)}]</Text>
      <Text dimColor>
        {isBusy
          ? "  /delegate /native /doctor   Q quit"
          : "  /mode /delegate /handoff /sessions"}
      </Text>
    </Box>
  );
}
