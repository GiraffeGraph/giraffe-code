import { initialTodoState, todoReducer } from "./todoReducer";
import type { TodoAction, TodoState } from "../types/todo";

type TodoListener = () => void;

export interface TodoStore {
  getState: () => TodoState;
  dispatch: (action: TodoAction) => void;
  subscribe: (listener: TodoListener) => () => void;
}

export function createTodoStore(initialState: TodoState = initialTodoState): TodoStore {
  let state = initialState;
  const listeners = new Set<TodoListener>();

  return {
    getState: () => state,

    dispatch: (action: TodoAction) => {
      state = todoReducer(state, action);
      listeners.forEach((listener) => listener());
    },

    subscribe: (listener: TodoListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const todoStore = createTodoStore();
