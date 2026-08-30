import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../types";

export function TaskCard({
  task,
  onEdit,
  overlay = false,
}: {
  task: Task;
  onEdit?: (task: Task) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { status: task.status } });

  const due = task.due !== undefined ? `due ${task.due}` : null;
  const canArchive = task.status === "done" || task.status === "wontdo";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => {
        if (overlay === false && onEdit !== undefined) onEdit(task);
      }}
      className={`card ${overlay ? "card--overlay" : ""} ${isDragging ? "card--dragging" : ""}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEdit !== undefined) onEdit(task);
      }}
    >
      <div className="card__title">{task.title}</div>
      {task.tags.length > 0 && (
        <div className="card__tags">
          {task.tags.map((tag) => (
            <span key={tag} className="card__tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      {(due !== null || canArchive) && (
        <div className="card__meta">
          {due !== null && <span className="card__due">{due}</span>}
          {canArchive && <span className="card__flag">♲</span>}
        </div>
      )}
    </div>
  );
}
