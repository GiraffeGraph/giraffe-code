import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { getConfig } from "../../config/loader.js";

const GIRAFFE_ART = [
  "  /\\  /\\  ",
  " (  \\/  ) ",
  "  \\    /  ",
  "  |    |  ",
  " /|    |\\ ",
];

export function GiraffeHeader(): React.ReactElement {
  const workerLabel = useMemo(() => {
    const workers = Object.keys(getConfig().agents);
    if (workers.length <= 4) return workers.join(" · ");
    return `${workers.slice(0, 4).join(" · ")} · +${workers.length - 4}`;
  }, []);

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
        <Text dimColor>  workers: {workerLabel}</Text>
      </Box>
    </Box>
  );
}
