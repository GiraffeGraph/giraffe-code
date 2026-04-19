import type { Todo } from "../types/todo";

interface TaskListContainerProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TaskListContainer({ todos, onToggle, onDelete }: TaskListContainerProps) {
  return (
    <section className="task-list-container" aria-live="polite">
      <header className="task-list-container__header">
        <h2>Task List</h2>
        <span className="task-list-container__count">{todos.length}</span>
      </header>

      {todos.length === 0 ? (
        <p className="task-list-container__empty">No tasks yet. Add your first task above.</p>
      ) : (
        <ul className="task-list-container__list">
          {todos.map((todo) => (
            <li
              className={`task-list-container__item ${todo.status === "completed" ? "is-completed" : ""}`}
              key={todo.id}
            >
              <div className="task-list-container__item-row">
                <label className="task-list-container__item-label">
                  <input
                    type="checkbox"
                    checked={todo.status === "completed"}
                    onChange={() => onToggle(todo.id)}
                  />
                  <span className="task-list-container__title" data-status={todo.status}>
                    {todo.title}
                  </span>
                  {todo.status === "completed" ? (
                    <span className="task-list-container__status-chip">Done</span>
                  ) : null}
                </label>

                <div className="task-list-container__item-actions">
                  <span className={`task-list-container__priority task-list-container__priority--${todo.priority}`}>
                    {todo.priority}
                  </span>
                  <button
                    type="button"
                    className="task-list-container__delete"
                    onClick={() => onDelete(todo.id)}
                    aria-label={`Delete task ${todo.title}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
