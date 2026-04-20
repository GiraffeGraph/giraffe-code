import React from "react";
import { Box } from "ink";
import { ScreenFrame, InputScreen, RunningScreen } from "./AppScreens.js";
import { LoginSelector } from "./LoginSelector.js";
import { ModelSelector } from "./ModelSelector.js";
import { StatusScreen } from "./StatusScreen.js";
import { LogoutSelector } from "./LogoutSelector.js";
import { DoctorScreen } from "./DoctorScreen.js";
import { NativeLauncher } from "./NativeLauncher.js";
import { useAppController } from "../controllers/useAppController.js";

interface AppProps {
  initialTask: string;
  needsLogin: boolean;
}

export function App({ initialTask, needsLogin }: AppProps): React.ReactElement {
  const controller = useAppController({ initialTask, needsLogin });

  if (controller.screen === "login") {
    return (
      <ScreenFrame rows={controller.rows}>
        <LoginSelector onComplete={controller.handleLoginComplete} />
      </ScreenFrame>
    );
  }

  if (controller.screen === "model") {
    return (
      <ScreenFrame rows={controller.rows}>
        <ModelSelector onComplete={controller.returnToInput} />
      </ScreenFrame>
    );
  }

  if (controller.screen === "status") {
    return (
      <ScreenFrame rows={controller.rows}>
        <StatusScreen onDone={controller.returnToInput} />
      </ScreenFrame>
    );
  }

  if (controller.screen === "logout") {
    return (
      <ScreenFrame rows={controller.rows}>
        <LogoutSelector onComplete={controller.returnToInput} />
      </ScreenFrame>
    );
  }

  if (controller.screen === "doctor") {
    return (
      <ScreenFrame rows={controller.rows}>
        <DoctorScreen onDone={controller.returnToInput} />
      </ScreenFrame>
    );
  }

  if (controller.screen === "native_launcher") {
    return (
      <ScreenFrame rows={controller.rows}>
        <NativeLauncher
          onLaunch={controller.launchNative}
          onCancel={controller.returnToInput}
        />
      </ScreenFrame>
    );
  }

  if (controller.screen === "input") {
    return <InputScreen controller={controller} />;
  }

  return <RunningScreen controller={controller} />;
}
