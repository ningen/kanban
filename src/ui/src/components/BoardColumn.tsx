import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { STATUS_COLOR, type Status, type Task } from "../types";
import { TaskCard } from "./TaskCard";

export function BoardColumn({
  status,
  label,
  tasks,
  query,
  onAdd,
  onEdit,
}: {
  status: Status;
  label: string;
  tasks: Task[];
  query: string;
  onAdd: () => void;
  onEdit: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      className={`column column--${status} flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5 min-h-[220px] transition-colors ${
        isOver ? "column--over" : ""
      }`}
    >
      <header className="flex items-center justify-between px-1 pb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest text-text-dim">
          <span
            className="h-2 w-2 flex-none rounded-full"
            style={{ background: STATUS_COLOR[status] }}
          />
          {label}
          <span className="rounded-full bg-surface-2 px-1.5 text-[10px] font-semibold text-text-dim">
            {tasks.length}
          </span>
        </span>
        <button
          type="button"
          className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md text-lg text-accent hover:bg-surface-2"
          onClick={onAdd}
          aria-label={`add to ${label}`}
        >
          +
        </button>
      </header>
      <div ref={setNodeRef} className="flex min-h-[120px] flex-col gap-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} query={query} onEdit={onEdit} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-xs text-text-dim/80">
            なし
          </div>
        )}
      </div>
    </section>
  );
}
