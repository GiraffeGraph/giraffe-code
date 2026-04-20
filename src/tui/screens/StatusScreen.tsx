import React, { useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { readAuthStore } from "../../auth/storage.js";
import { getUserConfig } from "../../config/userConfig.js";
import { getConfig } from "../../config/loader.js";

const ENV_VARS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  "openai-codex": "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
};

const ALL_PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "openai-codex", label: "OpenAI (Codex)" },
  { id: "gemini", label: "Google (Gemini)" },
];

interface StatusScreenProps {
  onDone: () => void;
}

export function StatusScreen({ onDone }: StatusScreenProps): React.ReactElement {
  const store = readAuthStore();
  const userConfig = getUserConfig();
  const agentsConfig = getConfig();

  const effectivePlanner =
    userConfig.planner?.provider ||
    agentsConfig.planner?.provider ||
    "auto-detect";
  const effectiveModel =
    userConfig.planner?.model ||
    agentsConfig.planner?.model ||
    "default";

  useInput((input, key) => {
    if (input === "q" || key.return || key.escape || (key.ctrl && input === "c")) {
      onDone();
    }
  });

  // Auto-exit after 10s if no input
  useEffect(() => {
    const t = setTimeout(onDone, 10_000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="yellow">🦒 Giraffe Code — Status</Text>
      <Box height={1} />

      <Text bold underline color="yellow">Auth</Text>
      {ALL_PROVIDERS.map(({ id, label }) => {
        const cred = store[id];
        const envVar = ENV_VARS[id];
        const hasEnv = envVar ? !!process.env[envVar] : false;

        let icon: string;
        let detail: string;
        let color: "green" | "yellow" | "gray";

        if (cred) {
          icon = "✓";
          detail = cred.type === "oauth" ? "OAuth" : "API Key";
          color = "green";
        } else if (hasEnv) {
          icon = "✓";
          detail = `env ${envVar ?? ""}`;
          color = "yellow";
        } else {
          icon = "✗";
          detail = "not configured";
          color = "gray";
        }

        return (
          <Box key={id} paddingLeft={2}>
            <Text color={color}>{icon} </Text>
            <Text color={color}>{label.padEnd(24)}</Text>
            <Text dimColor>{detail}</Text>
          </Box>
        );
      })}

      <Box height={1} />
      <Text bold underline color="yellow">Planner</Text>
      <Box paddingLeft={2} flexDirection="column">
        <Box>
          <Text dimColor>{"Provider: ".padEnd(12)}</Text>
          <Text color="yellow">{effectivePlanner}</Text>
          {userConfig.planner?.provider && (
            <Text dimColor>  (user config)</Text>
          )}
        </Box>
        <Box>
          <Text dimColor>{"Model:    ".padEnd(12)}</Text>
          <Text color="yellow">{effectiveModel}</Text>
        </Box>
      </Box>

      <Box height={1} />
      <Text bold underline color="yellow">Agents</Text>
      {Object.entries(agentsConfig.agents).map(([key, agent]) => (
        <Box key={key} paddingLeft={2}>
          <Text color="yellow">{key.padEnd(10)}</Text>
          <Text dimColor>{agent.command}  [{agent.strengths.join(", ")}]</Text>
        </Box>
      ))}

      <Box height={1} />
      <Text dimColor>Press Q or Enter to exit</Text>
    </Box>
  );
}
