import type { Todo, TodoAction, TodoState } from "../types/todo";

export const initialTodoState: TodoState = {
  todos: [],
  draft: "",
  filters: {
    mode: "all",
    query: "",
    priorities: [],
  },
};

function touch(todo: Todo, patch: Partial<Todo>): Todo {
  return {
    ...todo,
    ...patch,
    updatedAt: Date.now(),
  };
}

export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case "ADD_TODO":
      return {
        ...state,
        todos: [action.payload.todo, ...state.todos],
      };

    case "REMOVE_TODO":
      return {
        ...state,
        todos: state.todos.filter((todo) => todo.id !== action.payload.id),
      };

    case "TOGGLE_TODO":
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload.id
            ? touch(todo, {
                status: todo.status === "completed" ? "pending" : "completed",
              })
            : todo,
        ),
      };

    case "UPDATE_TODO_TITLE":
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload.id ? touch(todo, { title: action.payload.title }) : todo,
        ),
      };

    case "SET_DRAFT":
      return {
        ...state,
        draft: action.payload.draft,
      };

    case "SET_FILTER_MODE":
      return {
        ...state,
        filters: {
          ...state.filters,
          mode: action.payload.mode,
        },
      };

    case "SET_FILTER_QUERY":
      return {
        ...state,
        filters: {
          ...state.filters,
          query: action.payload.query,
        },
      };

    case "SET_FILTER_PRIORITIES":
      return {
        ...state,
        filters: {
          ...state.filters,
          priorities: action.payload.priorities,
        },
      };

    case "CLEAR_COMPLETED":
      return {
        ...state,
        todos: state.todos.filter((todo) => todo.status !== "completed"),
      };

    case "HYDRATE_STATE":
      return action.payload.state;

    case "RESET_STATE":
      return initialTodoState;

    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}
