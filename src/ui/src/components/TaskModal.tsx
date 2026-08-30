import { useState } from "react";
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

  return (
    <div className="modal__overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="modal__title">{isNew ? "New task" : "Edit task"}</h2>

        <label className="field">
          <span className="field__label">Title</span>
          <input
            autoFocus
            className="field__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="task title"
          />
        </label>

        <label className="field">
          <span className="field__label">Status</span>
          <select
            className="field__input"
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

        <label className="field">
          <span className="field__label">Tags (comma separated)</span>
          <input
            className="field__input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="review, q3"
          />
        </label>

        <label className="field">
          <span className="field__label">Due (YYYY-MM-DD)</span>
          <input
            type="date"
            className="field__input"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Notes</span>
          <textarea
            className="field__input field__textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="notes, progress, reasoning…"
          />
        </label>

        {error !== null && <div className="modal__error">{error}</div>}

        <div className="modal__actions">
          {!isNew && onArchive !== null && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void onArchive()}
            >
              Archive
            </button>
          )}
          <div className="modal__spacer" />
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
