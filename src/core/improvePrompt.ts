export function buildSelfImproveTask(focus?: string): string {
  const trimmed = focus?.trim();

  const base = [
    "You are working inside the giraffe-code repository itself.",
    "Improve this project with practical, low-risk, high-impact changes.",
    "",
    "Execution rules:",
    "1) Start by identifying the top 3 UX/DX/reliability pain points.",
    "2) Implement concrete improvements (code + docs if needed).",
    "3) Keep backward compatibility for existing commands and flows.",
    "4) Run verification (at least typecheck/build/tests when available).",
    "5) Summarize exactly what changed and why.",
  ];

  if (trimmed) {
    base.push("", `Extra focus: ${trimmed}`);
  }

  return base.join("\n");
}
