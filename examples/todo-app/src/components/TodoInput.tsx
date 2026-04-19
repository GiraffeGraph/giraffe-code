import type { FormEvent } from "react";

interface TodoInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onAdd: () => void;
}

export function TodoInput({ value, onValueChange, onAdd }: TodoInputProps) {
  const isEmpty = value.trim().length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isEmpty) {
      return;
    }

    onAdd();
  }

  return (
    <form className="todo-input" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="todo-input-field">
        New task
      </label>
      <input
        id="todo-input-field"
        className="todo-input__field"
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder="What needs to be done?"
        autoComplete="off"
      />
      <button className="todo-input__button" type="submit" disabled={isEmpty}>
        Add
      </button>
    </form>
  );
}
