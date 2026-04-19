import type { Todo } from "../types/todo";

interface TaskListContainerProps {
  todos: Todo[];
  onToggle: (id: string) => void;
}

export function TaskListContainer({ todos, onToggle }: TaskListContainerProps) {
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
            <li className="task-list-container__item" key={todo.id}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.status === "completed"}
                  onChange={() => onToggle(todo.id)}
                />
                <span data-status={todo.status}>{todo.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
