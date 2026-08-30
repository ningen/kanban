import { useEffect, useRef, useState } from "react";
import { STATUSES, type Status, type Task } from "../types";

export function TaskModal({
  task,
  isNew,
  onSave,
  onCancel,
  onArchive,
}: {
  task: Task;
  isNew: boolean;
  onSave: (task: Task) => Promise<void>;
  onCancel: () => void;
  onArchive: (() => Promise<void>) | null;
}) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<Status>(task.status);
  const [tags, setTags] = useState(task.tags.join(", "));
  const [due, setDue] = useState(task.due ?? "");
  const [body, setBody] = useState(task.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // Close on Escape and move focus into the dialog.
  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) {
      setError("title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next: Task = {
        ...task,
        title: title.trim(),
        status,
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (due.length > 0) next.due = due;
      else delete next.due;
      if (body.length > 0) next.body = body;
      else delete next.body;
      await onSave(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const field =
    "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/55 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "New task" : "Edit task"}
        className="flex max-h-[90vh] w-[520px] max-w-full flex-col gap-3.5 overflow-auto rounded-2xl border border-border bg-surface p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-lg">{isNew ? "New task" : "Edit task"}</h2>
          <button
            type="button"
            aria-label="close"
            onClick={onCancel}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:bg-surface-2"
          >
            ×
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-dim">Title</span>
          <input
            ref={firstFieldRef}
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="task title"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-dim">Status</span>
          <select
            className={field}
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-dim">Tags (comma separated)</span>
          <input
            className={field}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="review, q3"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-dim">Due (YYYY-MM-DD)</span>
          <input type="date" className={field} value={due} onChange={(e) => setDue(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-dim">Notes</span>
          <textarea
            className={`${field} resize-y`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="notes, progress, reasoning…"
          />
        </label>

        {error !== null && <div className="text-sm text-danger">{error}</div>}

        <div className="mt-1 flex gap-2">
          {!isNew && onArchive !== null && (
            <button
              type="button"
              className="rounded-lg border border-border bg-transparent px-3.5 py-2 text-sm hover:brightness-110"
              onClick={() => void onArchive()}
            >
              Archive
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            className="rounded-lg border border-border bg-transparent px-3.5 py-2 text-sm hover:brightness-110"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg border border-accent bg-accent px-3.5 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
