import { useInput } from "ink";
import type { AppScreen } from "./controllerShared.js";

interface UseAppShortcutsProps {
  screen: AppScreen;
  isBusy: boolean;
  returnToInput: () => void;
}

export function useAppShortcuts({
  screen,
  isBusy,
  returnToInput,
}: UseAppShortcutsProps): void {
  useInput((input, key) => {
    if (key.ctrl && input === "c") process.exit(0);
    if (screen === "running" && isBusy && input === "q") process.exit(0);
    if (screen === "running" && !isBusy && key.return) {
      returnToInput();
    }
  });
}
