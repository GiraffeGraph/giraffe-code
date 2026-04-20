import React from "react";
import { Box, Text } from "ink";
import { TaskTree } from "../components/TaskTree.js";
import { AgentPanel } from "../components/AgentPanel.js";
import { StatusBar } from "../components/StatusBar.js";
import { InputBox } from "../components/InputBox.js";
import { GiraffeHeader } from "../components/GiraffeHeader.js";
import { WorkspacePanel } from "../components/WorkspacePanel.js";
import type { useAppController } from "../controllers/useAppController.js";

type AppController = ReturnType<typeof useAppController>;

interface ScreenFrameProps {
  rows: number;
  children: React.ReactNode;
}

export function ScreenFrame({ rows, children }: ScreenFrameProps): React.ReactElement {
  return (
    <Box flexDirection="column" height={rows}>
      {children}
    </Box>
  );
}

interface InputScreenProps {
  controller: AppController;
}

export function InputScreen({ controller }: InputScreenProps): React.ReactElement {
  return (
    <ScreenFrame rows={controller.rows}>
      <GiraffeHeader />
      <Box flexGrow={1}>
        <Box width={controller.inputPaneWidth}>
          <InputBox
            onSubmit={controller.handleSubmit}
            onCommand={controller.handleCommand}
            lastStatus={controller.status}
            mode={controller.mode}
            delegateAgent={controller.delegateAgent}
          />
        </Box>
        <WorkspacePanel
          mode={controller.mode}
          delegateAgent={controller.delegateAgent}
          status={controller.status}
          activityLines={controller.outputLines}
          handoff={controller.latestHandoff}
          sessions={controller.recentSessions}
          agents={controller.agents}
        />
      </Box>
      <StatusBar
        currentAgent={controller.currentAgent}
        status={controller.status}
        stepInfo={controller.stepInfo}
        mode={controller.mode}
        delegateAgent={controller.delegateAgent}
        isBusy={false}
      />
    </ScreenFrame>
  );
}

interface RunningScreenProps {
  controller: AppController;
}

export function RunningScreen({ controller }: RunningScreenProps): React.ReactElement {
  return (
    <ScreenFrame rows={controller.rows}>
      <Box flexGrow={1}>
        <TaskTree plan={controller.taskPlan} />
        <AgentPanel
          lines={controller.outputLines}
          currentAgent={controller.currentAgent !== "—" ? controller.currentAgent : undefined}
        />
      </Box>
      <StatusBar
        currentAgent={controller.currentAgent}
        status={controller.status}
        stepInfo={controller.stepInfo}
        mode={controller.mode}
        delegateAgent={controller.delegateAgent}
        isBusy={controller.isBusy}
      />
      <Box paddingLeft={1}>
        <Text dimColor>
          {controller.isBusy ? "Q quit   Ctrl+C force quit" : "Enter new task   Ctrl+C quit"}
        </Text>
      </Box>
    </ScreenFrame>
  );
}
