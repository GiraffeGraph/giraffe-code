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
    { model: "claude-haiku-4-5-20251001",  label: "claude-haiku-4-5       — fast, cheap   (200K ctx)" },
    { model: "claude-sonnet-4-5-20250929", label: "claude-sonnet-4-5      — balanced      (200K ctx)" },
    { model: "claude-sonnet-4-6",          label: "claude-sonnet-4-6      — latest sonnet (1M ctx)" },
    { model: "claude-opus-4-5-20251101",   label: "claude-opus-4-5        — powerful      (200K ctx)" },
    { model: "claude-opus-4-7",            label: "claude-opus-4-7        — most capable  (1M ctx)" },
  ],
  "openai-codex": [
    { model: "gpt-5.4-mini",       label: "gpt-5.4-mini        — fast, cheap   (272K ctx)" },
    { model: "gpt-5.1-codex-mini", label: "gpt-5.1-codex-mini  — code-focused  (272K ctx)" },
    { model: "gpt-5.1",            label: "gpt-5.1             — balanced      (272K ctx)" },
    { model: "gpt-5.4",            label: "gpt-5.4             — capable       (272K ctx)" },
    { model: "gpt-5.1-codex-max",  label: "gpt-5.1-codex-max   — most capable  (272K ctx)" },
  ],
  gemini: [
    { model: "gemini-2.5-flash",       label: "gemini-2.5-flash        — fast         (1M ctx)" },
    { model: "gemini-2.5-pro",         label: "gemini-2.5-pro          — capable      (1M ctx)" },
    { model: "gemini-3-flash-preview", label: "gemini-3-flash-preview  — fast, new    (1M ctx)" },
    { model: "gemini-3-pro-preview",   label: "gemini-3-pro-preview    — most capable (1M ctx)" },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  "openai-codex": "OpenAI Codex  ⚠ requires API key, not subscription",
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
