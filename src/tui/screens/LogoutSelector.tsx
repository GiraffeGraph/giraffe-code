import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { readAuthStore, removeCredential } from "../../auth/storage.js";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  "openai-codex": "OpenAI (Codex)",
  gemini: "Google (Gemini)",
};

interface LogoutSelectorProps {
  onComplete: () => void;
}

export function LogoutSelector({ onComplete }: LogoutSelectorProps): React.ReactElement {
  const store = readAuthStore();
  const authedProviders = Object.keys(store);

  const [cursor, setCursor] = useState(0);
  const [done, setDone] = useState<string | null>(null);

  useInput((input, key) => {
    if (done !== null) {
      onComplete();
      return;
    }

    if (authedProviders.length === 0) {
      onComplete();
      return;
    }

    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(authedProviders.length - 1, c + 1));
    if (key.return) {
      const providerId = authedProviders[cursor];
      if (!providerId) return;
      removeCredential(providerId);
      setDone(providerId);
    }
    if (input === "q" || key.escape || (key.ctrl && input === "c")) onComplete();
  });

  if (authedProviders.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">🦒 Logout</Text>
        <Box height={1} />
        <Text dimColor>No authenticated providers found.</Text>
        <Box height={1} />
        <Text dimColor>Press any key to exit</Text>
      </Box>
    );
  }

  if (done !== null) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">🦒 Logged out</Text>
        <Box height={1} />
        <Text color="green">✓ Removed credentials for <Text color="yellow">{PROVIDER_LABELS[done] ?? done}</Text></Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="yellow">🦒 Logout — Select provider to remove</Text>
      <Box height={1} />
      {authedProviders.map((p, i) => (
        <Box key={p}>
          <Text color={i === cursor ? "yellow" : "white"}>
            {i === cursor ? "🦒 " : "   "}
            {PROVIDER_LABELS[p] ?? p}
          </Text>
        </Box>
      ))}
      <Box height={1} />
      <Text dimColor>↑↓ move   Enter remove   Q / Esc cancel</Text>
    </Box>
  );
}
