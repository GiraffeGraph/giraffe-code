import { EventEmitter } from "node:events";
import type { GiraffeState } from "./state.js";

interface GiraffeEventMap {
  output: [chunk: string];
  stateUpdate: [state: Partial<GiraffeState>];
  error: [message: string];
  done: [];
}

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof GiraffeEventMap>(
    event: K,
    ...args: GiraffeEventMap[K]
  ): boolean {
    return super.emit(event as string, ...args);
  }

  on<K extends keyof GiraffeEventMap>(
    event: K,
    listener: (...args: GiraffeEventMap[K]) => void
  ): this {
    return super.on(
      event as string,
      listener as (...args: unknown[]) => void
    );
  }

  off<K extends keyof GiraffeEventMap>(
    event: K,
    listener: (...args: GiraffeEventMap[K]) => void
  ): this {
    return super.off(
      event as string,
      listener as (...args: unknown[]) => void
    );
  }
}

export const eventBus = new TypedEventEmitter();
