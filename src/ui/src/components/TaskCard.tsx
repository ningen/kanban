import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Task } from "../types";
import { tagHue } from "../lib/tagColor";

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

  const isDone = task.status === "done";
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
      className={`card card--${task.status} flex w-full cursor-grab touch-none flex-col rounded-lg border border-border bg-surface-2 px-3 py-2.5 ${
        overlay ? "card--overlay" : ""
      } ${isDragging ? "card--dragging" : ""}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEdit !== undefined) onEdit(task);
      }}
    >
      <div className={`text-sm font-semibold leading-snug ${isDone ? "card__title--done" : ""}`}>
        {task.title}
      </div>
      {task.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="card__tag rounded-full px-1.5 py-0.5 text-[11px]"
              style={{ ["--tag-hue" as string]: String(tagHue(tag)) }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {(due !== null || canArchive) && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-text-dim">
          {due !== null && <span>{due}</span>}
          {canArchive && <span className="inline-flex items-center gap-1 text-wontdo">♲ archive</span>}
        </div>
      )}
    </div>
  );
}
