import React, { useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { runDoctorReport, type DoctorCheck, type DoctorStatus } from "../doctor/report.js";

interface DoctorScreenProps {
  onDone: () => void;
}

function statusIcon(status: DoctorStatus): string {
  if (status === "pass") return "✓";
  if (status === "warn") return "⚠";
  return "✗";
}

function statusColor(status: DoctorStatus): "green" | "yellow" | "red" {
  if (status === "pass") return "green";
  if (status === "warn") return "yellow";
  return "red";
}

function CheckRow({ check }: { check: DoctorCheck }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={statusColor(check.status)}>{statusIcon(check.status)} </Text>
        <Text bold>{check.title}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text dimColor>{check.detail}</Text>
      </Box>
      {check.hint && (
        <Box paddingLeft={2}>
          <Text color="yellow">→ {check.hint}</Text>
        </Box>
      )}
    </Box>
  );
}

export function DoctorScreen({ onDone }: DoctorScreenProps): React.ReactElement {
  const report = useMemo(() => runDoctorReport(), []);

  useInput((input, key) => {
    if (input === "q" || key.return || key.escape || (key.ctrl && input === "c")) {
      onDone();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="yellow">🦒 Giraffe Code — Doctor</Text>
      <Box height={1} />

      <Box>
        <Text color="green">✓ {report.summary.pass}</Text>
        <Text dimColor>   </Text>
        <Text color="yellow">⚠ {report.summary.warn}</Text>
        <Text dimColor>   </Text>
        <Text color="red">✗ {report.summary.fail}</Text>
      </Box>

      <Box height={1} />
      {report.checks.map((check, index) => (
        <CheckRow key={`${check.title}-${index}`} check={check} />
      ))}

      <Text dimColor>Press Q, Esc, or Enter to exit</Text>
    </Box>
  );
}
