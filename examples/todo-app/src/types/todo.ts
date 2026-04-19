export type TodoId = string;

export type TodoPriority = "low" | "medium" | "high";

export type TodoStatus = "pending" | "completed";

export type FilterMode = "all" | "active" | "completed";

export interface Todo {
  id: TodoId;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  createdAt: number;
  updatedAt: number;
}

export interface TodoFilters {
  mode: FilterMode;
  query: string;
  priorities: TodoPriority[];
}

export interface TodoState {
  todos: Todo[];
  draft: string;
  filters: TodoFilters;
}

export type TodoAction =
  | { type: "ADD_TODO"; payload: { todo: Todo } }
  | { type: "REMOVE_TODO"; payload: { id: TodoId } }
  | { type: "TOGGLE_TODO"; payload: { id: TodoId } }
  | { type: "UPDATE_TODO_TITLE"; payload: { id: TodoId; title: string } }
  | { type: "SET_DRAFT"; payload: { draft: string } }
  | { type: "SET_FILTER_MODE"; payload: { mode: FilterMode } }
  | { type: "SET_FILTER_QUERY"; payload: { query: string } }
  | { type: "SET_FILTER_PRIORITIES"; payload: { priorities: TodoPriority[] } }
  | { type: "CLEAR_COMPLETED" }
  | { type: "HYDRATE_STATE"; payload: { state: TodoState } }
  | { type: "RESET_STATE" };
