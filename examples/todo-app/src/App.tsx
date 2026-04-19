import { useEffect, useMemo, useState } from "react";
import { TaskListContainer } from "./components/TaskListContainer";
import { TodoInput } from "./components/TodoInput";
import { todoStore } from "./store/todoStore";
import type { FilterMode } from "./types/todo";
import { createTodo, getVisibleTodos, isTodoTitleValid } from "./utils/todoUtils";

const filterOptions: Array<{ mode: FilterMode; label: string }> = [
  { mode: "all", label: "All" },
  { mode: "active", label: "Active" },
  { mode: "completed", label: "Completed" },
];

export function App() {
  const [state, setState] = useState(() => todoStore.getState());

  useEffect(() => {
    return todoStore.subscribe(() => {
      setState(todoStore.getState());
    });
  }, []);

  const completedCount = useMemo(
    () => state.todos.filter((todo) => todo.status === "completed").length,
    [state.todos],
  );

  const pendingCount = state.todos.length - completedCount;
  const visibleTodos = useMemo(() => getVisibleTodos(state), [state]);

  function handleDraftChange(value: string) {
    todoStore.dispatch({ type: "SET_DRAFT", payload: { draft: value } });
  }

  function handleAddTodo() {
    if (!isTodoTitleValid(state.draft)) {
      return;
    }

    todoStore.dispatch({
      type: "ADD_TODO",
      payload: {
        todo: createTodo(state.draft),
      },
    });

    todoStore.dispatch({ type: "SET_DRAFT", payload: { draft: "" } });
  }

  function handleToggleTodo(id: string) {
    todoStore.dispatch({ type: "TOGGLE_TODO", payload: { id } });
  }

  function handleDeleteTodo(id: string) {
    todoStore.dispatch({ type: "REMOVE_TODO", payload: { id } });
  }

  function handleFilterMode(mode: FilterMode) {
    todoStore.dispatch({ type: "SET_FILTER_MODE", payload: { mode } });
  }

  function handleSearchChange(query: string) {
    todoStore.dispatch({ type: "SET_FILTER_QUERY", payload: { query } });
  }

  function handleClearCompleted() {
    todoStore.dispatch({ type: "CLEAR_COMPLETED" });
  }

  return (
    <div className="todo-page">
      <main className="todo-shell">
        <header className="todo-shell__header">
          <p className="todo-shell__eyebrow">Daily planner</p>
          <h1>Today&apos;s Focus</h1>
          <p className="todo-shell__subtitle">A clean workspace for planning what matters most.</p>
        </header>

        <section className="todo-shell__stats" aria-label="Task summary">
          <article className="todo-stat-card">
            <p className="todo-stat-card__label">Total tasks</p>
            <p className="todo-stat-card__value">{state.todos.length}</p>
          </article>
          <article className="todo-stat-card">
            <p className="todo-stat-card__label">In progress</p>
            <p className="todo-stat-card__value">{pendingCount}</p>
          </article>
          <article className="todo-stat-card">
            <p className="todo-stat-card__label">Completed</p>
            <p className="todo-stat-card__value">{completedCount}</p>
          </article>
        </section>

        <section className="todo-shell__composer" aria-label="Create and filter tasks">
          <TodoInput value={state.draft} onValueChange={handleDraftChange} onAdd={handleAddTodo} />

          <div className="todo-controls">
            <label className="todo-controls__search" htmlFor="todo-search">
              Search tasks
              <input
                id="todo-search"
                className="todo-controls__search-input"
                type="search"
                value={state.filters.query}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Find tasks"
              />
            </label>

            <div className="todo-controls__actions">
              <div className="todo-controls__filters" aria-label="Filter tasks">
                {filterOptions.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    aria-pressed={state.filters.mode === option.mode}
                    className={`todo-controls__filter ${state.filters.mode === option.mode ? "is-active" : ""}`}
                    onClick={() => handleFilterMode(option.mode)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="todo-controls__clear"
                onClick={handleClearCompleted}
                disabled={completedCount === 0}
              >
                Clear completed
              </button>
            </div>
          </div>
        </section>

        <TaskListContainer todos={visibleTodos} onToggle={handleToggleTodo} onDelete={handleDeleteTodo} />
      </main>
    </div>
  );
}
