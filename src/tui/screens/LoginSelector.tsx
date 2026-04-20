import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { PROVIDERS, PROVIDER_STORE_KEY } from "../../auth/types.js";
import { setCredential } from "../../auth/storage.js";
import { loginAnthropic } from "../../auth/oauth/anthropic.js";
import { loginOpenAI } from "../../auth/oauth/openai.js";
import type { ProviderMeta } from "../../auth/types.js";

type Phase =
  | { kind: "select" }
  | { kind: "api_key_input"; provider: ProviderMeta; value: string }
  | { kind: "oauth_progress"; provider: ProviderMeta; message: string }
  | { kind: "success"; provider: ProviderMeta }
  | { kind: "error"; message: string };

interface LoginSelectorProps {
  onComplete: (providerId: string) => void;
}

export function LoginSelector({ onComplete }: LoginSelectorProps): React.ReactElement {
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "select" });

  const handleApiKeySubmit = useCallback(
    (provider: ProviderMeta, key: string) => {
      const storeKey = PROVIDER_STORE_KEY[provider.id] ?? provider.id;
      setCredential(storeKey, { type: "api_key", key });
      setPhase({ kind: "success", provider });
      setTimeout(() => onComplete(storeKey), 800);
    },
    [onComplete]
  );

  const handleOAuth = useCallback(
    (provider: ProviderMeta) => {
      setPhase({ kind: "oauth_progress", provider, message: "Starting OAuth flow..." });

      const onProgress = (message: string): void => {
        setPhase({ kind: "oauth_progress", provider, message });
      };

      const loginFn =
        provider.id === "anthropic" ? loginAnthropic : loginOpenAI;

      loginFn(onProgress)
        .then((cred) => {
          const storeKey = PROVIDER_STORE_KEY[provider.id] ?? provider.id;
          setCredential(storeKey, cred);
          setPhase({ kind: "success", provider });
          setTimeout(() => onComplete(storeKey), 800);
        })
        .catch((err: Error) => {
          setPhase({ kind: "error", message: err.message });
        });
    },
    [onComplete]
  );

  useInput((input, key) => {
    if (phase.kind === "select") {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setCursor((c) => Math.min(PROVIDERS.length - 1, c + 1));
      if (key.return) {
        const selected = PROVIDERS[cursor];
        if (!selected) return;
        if (selected.authType === "oauth") {
          handleOAuth(selected);
        } else {
          setPhase({ kind: "api_key_input", provider: selected, value: "" });
        }
      }
      if (input === "q" || (key.ctrl && input === "c")) process.exit(0);
      return;
    }

    if (phase.kind === "api_key_input") {
      if (key.return) {
        if (phase.value.trim()) handleApiKeySubmit(phase.provider, phase.value.trim());
        return;
      }
      if (key.backspace || key.delete) {
        setPhase({ ...phase, value: phase.value.slice(0, -1) });
        return;
      }
      if (key.escape) {
        setPhase({ kind: "select" });
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setPhase({ ...phase, value: phase.value + input });
      }
      return;
    }

    if (phase.kind === "error") {
      if (key.return || input === "q") setPhase({ kind: "select" });
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="yellow">
        🦒 GIRAFFE CODE — Login
      </Text>
      <Box height={1} />

      {phase.kind === "select" && (
        <SelectMenu cursor={cursor} />
      )}

      {phase.kind === "api_key_input" && (
        <ApiKeyInput provider={phase.provider} value={phase.value} />
      )}

      {phase.kind === "oauth_progress" && (
        <OAuthProgress provider={phase.provider} message={phase.message} />
      )}

      {phase.kind === "success" && (
        <Box flexDirection="column">
          <Text color="green">
            ✅ Authenticated with {phase.provider.label.split("(")[0].trim()}
          </Text>
          <Text dimColor>Starting Giraffe Code...</Text>
        </Box>
      )}

      {phase.kind === "error" && (
        <Box flexDirection="column">
          <Text color="red">❌ Authentication failed:</Text>
          <Text color="red">{phase.message}</Text>
          <Box height={1} />
          <Text dimColor>Press Enter or Q to go back</Text>
        </Box>
      )}
    </Box>
  );
}

function SelectMenu({ cursor }: { cursor: number }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Select LLM provider for the planner:</Text>
      <Box height={1} />
      {PROVIDERS.map((p, i) => (
        <Box key={p.id}>
          <Text color={i === cursor ? "yellow" : "white"}>
            {i === cursor ? "🦒 " : "   "}
            {p.label}
          </Text>
        </Box>
      ))}
      <Box height={1} />
      <Text dimColor>↑↓ move   Enter select   Q quit</Text>
    </Box>
  );
}

function ApiKeyInput({
  provider,
  value,
}: {
  provider: ProviderMeta;
  value: string;
}): React.ReactElement {
  // Mask all but last 4 chars so it's not shown in plaintext
  const display =
    value.length > 4
      ? "•".repeat(value.length - 4) + value.slice(-4)
      : "•".repeat(value.length);

  return (
    <Box flexDirection="column">
      <Text>Enter API key for {provider.label.split("(")[0].trim()}:</Text>
      <Box height={1} />
      <Box>
        <Text dimColor>Key: </Text>
        <Text color="green">{display}</Text>
        <Text color="gray">█</Text>
      </Box>
      <Box height={1} />
      <Text dimColor>Enter to confirm   Esc to go back</Text>
      {provider.envVar && (
        <Text dimColor>
          (Tip: set {provider.envVar} env var to skip this step)
        </Text>
      )}
    </Box>
  );
}

function OAuthProgress({
  provider,
  message,
}: {
  provider: ProviderMeta;
  message: string;
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>
        Authenticating with {provider.label.split("(")[0].trim()}...
      </Text>
      <Box height={1} />
      {message.split("\n").map((line, i) => (
        <Text key={i} dimColor={i > 0} color={i === 0 ? "yellow" : undefined}>
          {i === 0 ? "🦒 " : "   "}{line}
        </Text>
      ))}
    </Box>
  );
}
