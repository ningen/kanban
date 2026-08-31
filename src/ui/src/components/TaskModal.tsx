import { useEffect, useRef, useState } from "react";
import { STATUSES, type Status, type Task } from "../types";
import { Button } from "./ui/Button";
import { DateField } from "./ui/DateField";
import { RichBody } from "./ui/RichBody";
import { Select } from "./ui/Select";
import { StatusDot } from "./ui/StatusDot";
import { TextField } from "./ui/TextField";

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

  // Focus the title only once, on mount. Keeping this out of the keydown
  // effect means a re-render (new `onCancel` identity) can't steal focus
  // away from whatever field the user is actually editing.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) {
      setError("Title is required");
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
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close is a pointer affordance; Escape and Cancel cover keyboard users
    <div
      className="modal__overlay fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/40 p-6 pt-[6vh]"
      onClick={onCancel}
      role="presentation"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: this onClick only stops propagation to the backdrop; it is not an action */}
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "New task" : "Edit task"}
        className="modal flex h-[84vh] w-[840px] max-w-full flex-col rounded-xl border border-border bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <StatusDot status={status} />
            <h2 className="m-0 text-sm font-semibold">{isNew ? "New task" : "Edit task"}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="close"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-surface-2 hover:text-text"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Two-column: main editor + metadata sidebar */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Main: title + body (gets the remaining space) */}
          <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <TextField
              ref={titleRef}
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              {...(error !== null ? { error } : {})}
            />
            <div className="flex min-h-0 flex-1 flex-col">
              <RichBody
                label="Notes"
                value={body}
                onChange={setBody}
                className="min-h-[420px] flex-1"
                placeholder={"Markdown で記述（# 見出し / - リスト / - [ ] タスク / `code`）…"}
              />
            </div>
          </div>

          {/* Sidebar: metadata */}
          <div className="flex w-[220px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border px-5 py-5">
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <DateField label="Due" value={due} onChange={setDue} />
            <TextField
              label="Tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="review, q3"
              hint="Comma separated"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3.5">
          <div>
            {!isNew && onArchive !== null && (
              <Button variant="ghost" size="sm" onClick={() => void onArchive()}>
                Archive
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
