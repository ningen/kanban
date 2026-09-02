import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { formatRelative } from "../lib/formatRelative";
import type { Task } from "../types";
import { DueBadge } from "./ui/DueBadge";
import { Tag } from "./ui/Tag";

/** Wrap case-insensitive occurrences of `q` in `text` with <mark>. */
function highlight(text: string, q: string): ReactNode {
  if (q.length === 0) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let pos = 0;
  let key = 0;
  while (pos < text.length) {
    const idx = lower.indexOf(needle, pos);
    if (idx < 0) {
      parts.push(text.slice(pos));
      break;
    }
    if (idx > pos) parts.push(text.slice(pos, idx));
    parts.push(
      <mark key={key++} className="rounded bg-accent-soft px-0.5 text-accent">
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    pos = idx + needle.length;
  }
  return parts;
}

export function TaskCard({
  task,
  query,
  onEdit,
  overlay = false,
}: {
  task: Task;
  query?: string;
  onEdit?: (task: Task) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });

  const isDone = task.status === "done";
  const q = query ?? "";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: dnd-kit draggable; a <button> can't hold this nested block layout
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => {
        if (overlay === false && onEdit !== undefined) onEdit(task);
      }}
      className={cn(
        "card",
        `card--${task.status}`,
        "flex w-full cursor-grab touch-none flex-col gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2.5 shadow-sm transition-all hover:border-border-strong hover:shadow-md",
        overlay && "card--overlay",
        isDragging && "card--dragging",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEdit !== undefined) onEdit(task);
      }}
    >
      <div className={cn("text-sm font-medium leading-snug", isDone && "card__title--done")}>
        {highlight(task.title, q)}
      </div>
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <Tag key={tag} name={tag} />
          ))}
        </div>
      )}
      {task.due !== undefined && (
        <div className="flex flex-wrap items-center gap-1.5">
          {task.due !== undefined && <DueBadge due={task.due} status={task.status} />}
        </div>
      )}
      {task.updated !== "" && (
        <div className="text-[10px] text-text-faint" title={`updated ${task.updated}`}>
          updated {formatRelative(task.updated)}
        </div>
      )}
    </div>
  );
}
