import React from "react";
import { Box, Text } from "ink";

const GIRAFFE_ART = [
  "  /\\  /\\  ",
  " (  \\/  ) ",
  "  \\    /  ",
  "  |    |  ",
  " /|    |\\ ",
];

export function GiraffeHeader(): React.ReactElement {
  return (
    <Box flexDirection="row" paddingX={1} paddingTop={1}>
      <Box flexDirection="column" marginRight={2}>
        {GIRAFFE_ART.map((line, i) => (
          <Text key={i} color="yellow">
            {line}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" justifyContent="center">
        <Text bold color="yellow">
          ┏━━━━━━━━━━━━━━━━━━━━━━┓
        </Text>
        <Text bold color="yellow">
          ┃  🦒  GIRAFFE CODE   ┃
        </Text>
        <Text color="yellow">
          ┃  multi-agent orch.  ┃
        </Text>
        <Text color="yellow">
          ┗━━━━━━━━━━━━━━━━━━━━━━┛
        </Text>
        <Text dimColor>  claude · codex · gemini · pi</Text>
      </Box>
    </Box>
  );
}
