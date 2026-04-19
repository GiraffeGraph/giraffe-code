import type { Todo, TodoPriority, TodoState } from "../types/todo";

export function normalizeTodoTitle(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function isTodoTitleValid(input: string): boolean {
  return normalizeTodoTitle(input).length > 0;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createTodo(title: string, priority: TodoPriority = "medium"): Todo {
  const now = Date.now();

  return {
    id: createId(),
    title: normalizeTodoTitle(title),
    status: "pending",
    priority,
    createdAt: now,
    updatedAt: now,
  };
}

export function getVisibleTodos(state: TodoState): Todo[] {
  const query = state.filters.query.trim().toLowerCase();

  return state.todos.filter((todo) => {
    const modeMatch =
      state.filters.mode === "all" ||
      (state.filters.mode === "active" && todo.status === "pending") ||
      (state.filters.mode === "completed" && todo.status === "completed");

    const priorityMatch =
      state.filters.priorities.length === 0 || state.filters.priorities.includes(todo.priority);

    const queryMatch = query.length === 0 || todo.title.toLowerCase().includes(query);

    return modeMatch && priorityMatch && queryMatch;
  });
}
