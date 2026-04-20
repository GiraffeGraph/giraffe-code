import { HandoffData, HandoffDataSchema } from "../../types/config.js";

const HANDOFF_REGEX = /\[GIRAFFE_HANDOFF\]([\s\S]*?)\[\/GIRAFFE_HANDOFF\]/;

export function extractHandoff(output: string): HandoffData | null {
  const match = output.match(HANDOFF_REGEX);
  if (!match || !match[1]) return null;

  const body = match[1];

  const getField = (key: string): string => {
    const lineMatch = body.match(new RegExp(`^${key}:(.+)$`, "m"));
    return lineMatch?.[1]?.trim() ?? "";
  };

  try {
    return HandoffDataSchema.parse({
      completed: getField("COMPLETED"),
      files: getField("FILES")
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0 && f !== "none"),
      context: getField("CONTEXT"),
      nextHint: getField("NEXT_HINT"),
    });
  } catch {
    return null;
  }
}

export function formatHandoffForNextAgent(
  agentName: string,
  data: HandoffData
): string {
  const lines = [
    `Previous agent (${agentName}) completed:`,
    `- ${data.completed}`,
  ];

  if (data.files.length > 0) {
    lines.push(`- Files: ${data.files.join(", ")}`);
  }

  if (data.context) {
    lines.push(`- Context: ${data.context}`);
  }

  if (data.nextHint) {
    lines.push(`- Hint: ${data.nextHint}`);
  }

  return lines.join("\n");
}
