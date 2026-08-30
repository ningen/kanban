import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Status, Task } from "../types";
import { cn } from "../lib/cn";
import { Button } from "./ui/Button";
import { StatusDot } from "./ui/StatusDot";
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
      className={cn(
        "column",
        `column--${status}`,
        "flex min-h-[220px] flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 shadow-sm transition-colors",
        isOver && "column--over",
      )}
    >
      <header className="flex items-center justify-between px-1 pb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest text-text-dim">
          <StatusDot status={status} />
          {label}
          <span className="rounded-full bg-surface-3 px-1.5 text-[10px] font-medium text-text-dim">
            {tasks.length}
          </span>
        </span>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-accent" onClick={onAdd} aria-label={`add to ${label}`}>
          +
        </Button>
      </header>
      <div ref={setNodeRef} className="flex min-h-[120px] flex-col gap-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} query={query} onEdit={onEdit} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-xs text-text-faint">
            なし
          </div>
        )}
      </div>
    </section>
  );
}
