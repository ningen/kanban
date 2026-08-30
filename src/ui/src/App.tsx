import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { useBoard } from "./hooks/useBoard";
import { computeMove, editTask, createTask, archiveTask, type CreatePayload, type EditPayload } from "./api";
import {
  BOARD_COLUMNS,
  DONE_VISIBLE_DAYS,
  isStatus,
  type Status,
  type Task,
} from "./types";
import { BoardColumn } from "./components/BoardColumn";
import { TaskCard } from "./components/TaskCard";
import { TaskModal } from "./components/TaskModal";
import { emptyTask } from "./lib/taskUtils";
import "./styles.css";

/** Whether a `done` task is still within the visible window. */
function isDoneVisible(task: Task): boolean {
  if (task.status !== "done") return true;
  const completed = task.completed ? Date.parse(task.completed) : Date.now();
  if (Number.isNaN(completed)) return true;
  const ageDays = (Date.now() - completed) / 86_400_000;
  return ageDays <= DONE_VISIBLE_DAYS;
}

export function App() {
  const { board, loading, error, refresh } = useBoard();
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [modal, setModal] = useState<{ task: Task; isNew: boolean } | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);

  const allTags = useMemo(() => {
    const seen = new Set<string>();
    for (const task of board?.tasks ?? []) {
      for (const tag of task.tags) seen.add(tag);
    }
    return [...seen].sort();
  }, [board]);

  // Require a small drag distance before a drag activates, so simple clicks
  // bubble through to open the edit modal without starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const tasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (board?.tasks ?? [])
      .filter(isDoneVisible)
      .filter((t) => (activeTag === null ? true : t.tags.includes(activeTag)))
      .filter((t) => {
        if (q.length === 0) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.body ?? "").toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      });
  }, [board, query, activeTag]);

  async function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (over === null) return;
    const draggedId = String(active.id);
    if (typeof active.data.current?.status !== "string") return;
    const fromStatus = active.data.current.status as Status;

    const overId = String(over.id);
    let targetStatus: Status;
    let targetIndex: number;

    if (isStatus(overId)) {
      // dropped on a column's empty area -> append to end
      targetStatus = overId;
      targetIndex = Number.MAX_SAFE_INTEGER;
    } else {
      const overTask = board?.tasks.find((t) => t.id === overId);
      if (overTask === undefined) return;
      targetStatus = overTask.status;
      const visited = tasks.filter((t) => t.status === targetStatus);
      targetIndex = visited.findIndex((t) => t.id === overId);
      if (targetIndex < 0) targetIndex = visited.length;
    }

    if (fromStatus === targetStatus && overId === draggedId) return;

    const move = computeMove(board?.tasks ?? [], draggedId, targetStatus, targetIndex);
    try {
      await editTask(draggedId, { status: move.status, rank: move.rank });
    } catch {
      await refresh();
    }
  }

  function openNew(status: Status) {
    setModal({ task: emptyTask(status), isNew: true });
  }

  function openEdit(task: Task) {
    setModal({ task: { ...task }, isNew: false });
  }

  async function handleSave(task: Task) {
    if (modal === null) throw new Error("no modal");
    if (modal.isNew) {
      const payload: CreatePayload = {
        title: task.title,
        status: task.status,
        tags: task.tags,
      };
      if (task.due !== undefined) payload.due = task.due;
      if (task.body !== undefined) payload.body = task.body;
      await createTask(payload);
    } else {
      const payload: EditPayload = {
        title: task.title,
        status: task.status,
        tags: task.tags,
        due: task.due ?? null,
      };
      if (task.body !== undefined) payload.body = task.body;
      await editTask(task.id, payload);
    }
    setModal(null);
  }

  if (loading && board === null) {
    return <div className="app app--center">loading…</div>;
  }

  return (
    <div className="app">
      <header className="toolbar">
        <h1 className="toolbar__title">kanban</h1>
        <input
          className="toolbar__search"
          type="search"
          placeholder="検索…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="toolbar__tags">
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`chip ${activeTag === tag ? "chip--active" : ""}`}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </header>

      {error !== null && <div className="banner banner--error">error: {error}</div>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => {
          const task = board?.tasks.find((t) => t.id === e.active.id);
          setDragging(task ?? null);
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <main className="board">
          {BOARD_COLUMNS.map((col) => {
            const columnTasks = tasks
              .filter((t) => t.status === col.status)
              .sort((a, b) => a.rank - b.rank);
            return (
              <BoardColumn
                key={col.status}
                status={col.status}
                label={col.label}
                tasks={columnTasks}
                onAdd={() => openNew(col.status)}
                onEdit={openEdit}
              />
            );
          })}
        </main>
        <DragOverlay>
          {dragging !== null ? <TaskCard task={dragging} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {modal !== null && (
        <TaskModal
          task={modal.task}
          isNew={modal.isNew}
          onSave={handleSave}
          onCancel={() => setModal(null)}
          onArchive={async () => {
            if (modal.isNew) return;
            await archiveTask(modal.task.id);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
