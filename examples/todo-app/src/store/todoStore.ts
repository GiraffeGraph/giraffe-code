import { initialTodoState, todoReducer } from "./todoReducer";
import type { Todo, TodoAction, TodoFilters, TodoState } from "../types/todo";

const STORAGE_KEY = "giraffe.todo.state.v1";

type TodoListener = () => void;

export interface TodoStore {
  getState: () => TodoState;
  dispatch: (action: TodoAction) => void;
  subscribe: (listener: TodoListener) => () => void;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isTodo(value: unknown): value is Todo {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Todo>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    (candidate.status === "pending" || candidate.status === "completed") &&
    (candidate.priority === "low" || candidate.priority === "medium" || candidate.priority === "high") &&
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt) &&
    typeof candidate.updatedAt === "number" &&
    Number.isFinite(candidate.updatedAt)
  );
}

function isTodoFilters(value: unknown): value is TodoFilters {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<TodoFilters>;

  return (
    (candidate.mode === "all" || candidate.mode === "active" || candidate.mode === "completed") &&
    typeof candidate.query === "string" &&
    Array.isArray(candidate.priorities) &&
    candidate.priorities.every(
      (priority) => priority === "low" || priority === "medium" || priority === "high",
    )
  );
}

function isTodoState(value: unknown): value is TodoState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<TodoState>;

  return (
    Array.isArray(candidate.todos) &&
    candidate.todos.every((todo) => isTodo(todo)) &&
    typeof candidate.draft === "string" &&
    isTodoFilters(candidate.filters)
  );
}

function loadPersistedState(): TodoState {
  if (!canUseStorage()) {
    return initialTodoState;
  }

  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);

    if (!rawState) {
      return initialTodoState;
    }

    const parsedState: unknown = JSON.parse(rawState);

    if (!isTodoState(parsedState)) {
      return initialTodoState;
    }

    return parsedState;
  } catch {
    return initialTodoState;
  }
}

function persistState(state: TodoState): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota and serialization failures so the app keeps working.
  }
}

export function createTodoStore(initialState: TodoState = loadPersistedState()): TodoStore {
  let state = initialState;
  const listeners = new Set<TodoListener>();

  return {
    getState: () => state,

    dispatch: (action: TodoAction) => {
      state = todoReducer(state, action);
      persistState(state);
      listeners.forEach((listener) => listener());
    },

    subscribe: (listener: TodoListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const todoStore = createTodoStore();
