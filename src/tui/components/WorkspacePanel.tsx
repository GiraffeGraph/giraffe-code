import React from "react";
import { Box, Text } from "ink";
import type { StoredHandoff, RecentSession } from "../../core/runtime/workspaceRuntime.js";
import type { InteractiveMode } from "../controllers/controllerShared.js";

interface WorkspacePanelProps {
  mode: InteractiveMode;
  delegateAgent: string;
  status: string;
  activityLines: string[];
  handoff: StoredHandoff | null;
  sessions: RecentSession[];
  agents: string[];
}

function compact(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function WorkspacePanel({
  mode,
  delegateAgent,
  status,
  activityLines,
  handoff,
  sessions,
  agents,
}: WorkspacePanelProps): React.ReactElement {
  const recentActivity = activityLines
    .join("")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-6);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor="yellow"
      paddingLeft={1}
      paddingRight={1}
    >
      <Text bold color="yellow">🧭 WORKSPACE</Text>
      <Text dimColor>.giraffe runtime • worker-first orchestration</Text>
      <Box height={1} />

      <Text bold color="yellow">Mode</Text>
      <Text>
        {mode === "delegate" ? `delegate:${delegateAgent}` : mode}
      </Text>

      <Box height={1} />
      <Text bold color="yellow">Latest handoff</Text>
      {handoff ? (
        <Box flexDirection="column">
          <Text>task: {compact(handoff.task, 44)}</Text>
          <Text dimColor>summary: {compact(handoff.summary, 44)}</Text>
          <Text dimColor>
            agents: {handoff.agents.length} • session: {handoff.sessionId}
          </Text>
        </Box>
      ) : (
        <Text dimColor>no workspace handoff yet</Text>
      )}

      <Box height={1} />
      <Text bold color="yellow">Workers</Text>
      <Text dimColor>{agents.join(" · ")}</Text>

      <Box height={1} />
      <Text bold color="yellow">Recent sessions</Text>
      {sessions.length > 0 ? (
        sessions.map((session) => (
          <Text key={session.sessionId} dimColor>
            - {session.sessionId}
          </Text>
        ))
      ) : (
        <Text dimColor>no sessions yet</Text>
      )}

      <Box height={1} />
      <Text bold color="yellow">Recent activity</Text>
      {recentActivity.length > 0 ? (
        recentActivity.map((line, index) => (
          <Text key={`${index}-${line}`} dimColor>
            {compact(line, 54)}
          </Text>
        ))
      ) : (
        <Text dimColor>{compact(status || "idle", 54)}</Text>
      )}

      <Box height={1} />
      <Text bold color="yellow">Quick commands</Text>
      <Text dimColor>/mode  /delegate  /resume</Text>
      <Text dimColor>/handoff  /sessions  /native</Text>
    </Box>
  );
}
