import { useEffect, useRef, useState } from "react";
import { STATUSES, type Status, type Task } from "../types";
import { TextField } from "./ui/TextField";
import { Textarea } from "./ui/Textarea";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";

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
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) {
      setError("titleは必須です");
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

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "New task" : "Edit task"}
        className="flex max-h-[90vh] w-[520px] max-w-full flex-col gap-4 overflow-auto rounded-xl border border-border bg-surface p-5 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-lg font-semibold">{isNew ? "New task" : "Edit task"}</h2>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="close">
            ×
          </Button>
        </div>

        <TextField
          ref={titleRef}
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="task title"
          {...(error !== null ? { error } : {})}
        />

        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <TextField
          label="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="review, q3"
        />

        <TextField
          label="Due (YYYY-MM-DD)"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />

        <Textarea
          label="Notes"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="notes, progress, reasoning…"
        />

        <div className="mt-1 flex gap-2">
          {!isNew && onArchive !== null && (
            <Button variant="outline" onClick={() => void onArchive()}>
              Archive
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
