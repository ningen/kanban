import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Status, Task } from "../types";
import { TaskCard } from "./TaskCard";

export function BoardColumn({
  status,
  label,
  tasks,
  onAdd,
  onEdit,
}: {
  status: Status;
  label: string;
  tasks: Task[];
  onAdd: () => void;
  onEdit: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section className={`column ${isOver ? "column--over" : ""}`}>
      <header className="column__header">
        <span className="column__label">{label}</span>
        <button className="column__add" onClick={onAdd} aria-label={`add to ${label}`}>
          +
        </button>
      </header>
      <div ref={setNodeRef} className="column__cards">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={onEdit} />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}
