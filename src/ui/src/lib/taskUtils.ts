import type { Status, Task } from "../types";

/** Create a blank (unsaved) task for the add-modal. */
export function emptyTask(status: Status): Task {
  const now = new Date().toISOString();
  return {
    id: "",
    title: "",
    status,
    rank: 0,
    tags: [],
    created: now,
    updated: now,
  };
}
