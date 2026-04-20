import React, { memo } from "react";
import { Box, Text } from "ink";

interface AgentPanelProps {
  lines: string[];
  currentAgent?: string;
}

function compact(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const AgentPanel = memo(function AgentPanel({
  lines,
  currentAgent,
}: AgentPanelProps): React.ReactElement {
  const maxLines = Math.max((process.stdout.rows ?? 40) - 12, 10);
  const fullText = lines.join("").replace(/\r/g, "");
  const allLines = fullText.split("\n");
  const visible = allLines.filter(Boolean).slice(-maxLines);
  const title = currentAgent
    ? `${currentAgent.toUpperCase()} — live worker stream`
    : "ACTIVITY — worker stream";

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor="yellow"
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
    >
      <Text bold color="yellow">🖥 {title}</Text>
      <Text dimColor>{visible.length} visible lines</Text>
      <Box height={1} />
      {visible.length === 0 ? (
        <Box flexDirection="column">
          <Text dimColor>waiting for a worker to speak…</Text>
          <Text dimColor>native CLIs stay external; Giraffe only orchestrates them.</Text>
        </Box>
      ) : (
        visible.map((line, i) => (
          <Text key={`${i}-${line}`} wrap="truncate">
            {compact(line)}
          </Text>
        ))
      )}
    </Box>
  );
});
