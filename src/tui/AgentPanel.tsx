import React, { memo } from "react";
import { Box, Text } from "ink";

interface AgentPanelProps {
  lines: string[];
  currentAgent?: string;
}

export const AgentPanel = memo(function AgentPanel({
  lines,
  currentAgent,
}: AgentPanelProps): React.ReactElement {
  const maxLines = Math.max((process.stdout.rows ?? 40) - 10, 10);
  const visible = lines.slice(-maxLines);

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
      <Text bold color="yellow">
        🦒 {currentAgent ? `${currentAgent.toUpperCase()} — Live Output` : "AGENT OUTPUT — Live"}
      </Text>
      <Box height={1} />
      {visible.length === 0 ? (
        <Text dimColor>waiting for the giraffe to start typing...</Text>
      ) : (
        visible.map((chunk, i) => (
          <Text key={i} wrap="truncate">
            {chunk}
          </Text>
        ))
      )}
    </Box>
  );
});
