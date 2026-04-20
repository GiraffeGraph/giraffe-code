import { useMemo } from "react";
import { getConfig } from "../../config/loader.js";
import {
  getLatestWorkspaceHandoff,
  listRecentWorkspaceSessions,
} from "../../core/runtime/workspaceRuntime.js";

export function useWorkspaceSnapshot(activityVersion: number, status: string) {
  const agents = useMemo(() => Object.keys(getConfig().agents), []);
  const latestHandoff = useMemo(
    () => getLatestWorkspaceHandoff(),
    [activityVersion, status]
  );
  const recentSessions = useMemo(
    () => listRecentWorkspaceSessions(4),
    [activityVersion, status]
  );

  return {
    agents,
    latestHandoff,
    recentSessions,
  };
}
