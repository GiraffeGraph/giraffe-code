import React, { memo } from "react";
import { Box, Text } from "ink";

interface AgentPanelProps {
  lines: string[];
}

// Memoized to prevent re-renders of the entire output history on every new chunk.
// Only re-renders when the lines array reference changes (which happens on each append).
export const AgentPanel = memo(function AgentPanel({
  lines,
}: AgentPanelProps): React.ReactElement {
  // Keep last N lines so the panel doesn't grow unbounded
  const maxLines = Math.max((process.stdout.rows ?? 40) - 6, 10);
  const visible = lines.slice(-maxLines);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
    >
      <Text bold underline>
        AGENT OUTPUT (Live)
      </Text>
      <Box height={1} />
      {visible.length === 0 ? (
        <Text dimColor>[Waiting for agent output...]</Text>
      ) : (
        visible.map((chunk, i) => (
          // Each chunk is raw PTY output — ANSI codes pass through and render as colors
          <Text key={i} wrap="truncate">
            {chunk}
          </Text>
        ))
      )}
    </Box>
  );
});
