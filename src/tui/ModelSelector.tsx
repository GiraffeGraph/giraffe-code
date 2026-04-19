import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { getUserConfig, setUserConfig } from "../config/userConfig.js";
import { readAuthStore } from "../auth/storage.js";

interface ModelEntry {
  model: string;
  label: string;
}

const PROVIDER_MODELS: Record<string, ModelEntry[]> = {
  anthropic: [
    { model: "claude-haiku-4-5", label: "claude-haiku-4-5   — fast, cheap" },
    { model: "claude-sonnet-4-5", label: "claude-sonnet-4-5  — balanced" },
    { model: "claude-opus-4-5", label: "claude-opus-4-5    — most capable" },
  ],
  "openai-codex": [
    { model: "gpt-4o-mini", label: "gpt-4o-mini  — fast, cheap" },
    { model: "gpt-4o", label: "gpt-4o       — balanced" },
  ],
  gemini: [
    { model: "gemini-1.5-flash", label: "gemini-1.5-flash  — fast" },
    { model: "gemini-1.5-pro", label: "gemini-1.5-pro    — capable" },
    { model: "gemini-2.0-flash", label: "gemini-2.0-flash  — fast, new" },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  "openai-codex": "OpenAI Codex",
  gemini: "Google Gemini",
};

interface ModelSelectorProps {
  onComplete: () => void;
}

type Step = "provider" | "model";

export function ModelSelector({ onComplete }: ModelSelectorProps): React.ReactElement {
  const userConfig = getUserConfig();
  const store = readAuthStore();
  const currentProvider = userConfig.planner?.provider ?? "";
  const currentModel = userConfig.planner?.model ?? "";

  // Only offer providers that are authenticated
  const availableProviders = Object.keys(PROVIDER_MODELS).filter(
    (p) => p in store || process.env["ANTHROPIC_API_KEY"] || process.env["OPENAI_API_KEY"] || process.env["GEMINI_API_KEY"]
  );

  // Always include all if store is empty (let user pick even if not yet authed)
  const providerList = availableProviders.length > 0
    ? availableProviders
    : Object.keys(PROVIDER_MODELS);

  const [step, setStep] = useState<Step>("provider");
  const [providerCursor, setProviderCursor] = useState(() =>
    Math.max(0, providerList.indexOf(currentProvider))
  );
  const [selectedProvider, setSelectedProvider] = useState(currentProvider);
  const [modelCursor, setModelCursor] = useState(0);
  const [saved, setSaved] = useState(false);

  useInput((input, key) => {
    if (saved) return;

    if (step === "provider") {
      if (key.upArrow) setProviderCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setProviderCursor((c) => Math.min(providerList.length - 1, c + 1));
      if (key.return) {
        const prov = providerList[providerCursor];
        if (!prov) return;
        setSelectedProvider(prov);
        const models = PROVIDER_MODELS[prov] ?? [];
        const existingIdx = models.findIndex((m) => m.model === currentModel);
        setModelCursor(existingIdx >= 0 ? existingIdx : 0);
        setStep("model");
      }
      if (input === "q" || (key.ctrl && input === "c")) process.exit(0);
    } else {
      const models = PROVIDER_MODELS[selectedProvider] ?? [];
      if (key.upArrow) setModelCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setModelCursor((c) => Math.min(models.length - 1, c + 1));
      if (key.return) {
        const chosen = models[modelCursor];
        if (!chosen) return;
        const existing = getUserConfig();
        setUserConfig({ ...existing, planner: { provider: selectedProvider, model: chosen.model } });
        setSaved(true);
        setTimeout(onComplete, 800);
      }
      if (key.escape) setStep("provider");
      if (input === "q" || (key.ctrl && input === "c")) process.exit(0);
    }
  });

  if (saved) {
    const models = PROVIDER_MODELS[selectedProvider] ?? [];
    const chosen = models[modelCursor];
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">🦒 Planner model saved!</Text>
        <Box height={1} />
        <Text>Provider: <Text color="yellow">{PROVIDER_LABELS[selectedProvider] ?? selectedProvider}</Text></Text>
        <Text>Model:    <Text color="yellow">{chosen?.model ?? ""}</Text></Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="yellow">🦒 Select Planner Model</Text>
      <Box height={1} />

      {step === "provider" ? (
        <Box flexDirection="column">
          <Text dimColor>Which provider should run the planner?</Text>
          <Box height={1} />
          {providerList.map((p, i) => {
            const isCurrent = p === currentProvider;
            return (
              <Box key={p}>
                <Text color={i === providerCursor ? "yellow" : "white"}>
                  {i === providerCursor ? "🦒 " : "   "}
                  {PROVIDER_LABELS[p] ?? p}
                  {isCurrent ? <Text dimColor>  ← current</Text> : null}
                </Text>
              </Box>
            );
          })}
          <Box height={1} />
          <Text dimColor>↑↓ move   Enter select   Q quit</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text dimColor>
            Select model for <Text color="yellow">{PROVIDER_LABELS[selectedProvider] ?? selectedProvider}</Text>:
          </Text>
          <Box height={1} />
          {(PROVIDER_MODELS[selectedProvider] ?? []).map((m, i) => {
            const isCurrent = m.model === currentModel && selectedProvider === currentProvider;
            return (
              <Box key={m.model}>
                <Text color={i === modelCursor ? "yellow" : "white"}>
                  {i === modelCursor ? "🦒 " : "   "}
                  {m.label}
                  {isCurrent ? <Text dimColor>  ← current</Text> : null}
                </Text>
              </Box>
            );
          })}
          <Box height={1} />
          <Text dimColor>↑↓ move   Enter confirm   Esc back</Text>
        </Box>
      )}
    </Box>
  );
}
