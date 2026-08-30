import type { Status } from "../../types";
import { STATUS_COLOR } from "../../types";

/** Small colored dot representing a task status. */
export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 flex-none rounded-full ${className ?? ""}`}
      style={{ background: STATUS_COLOR[status] }}
    />
  );
}
