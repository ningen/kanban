import { cn } from "../../lib/cn";

/** Toggleable filter pill (single-select). Reflects its active state via aria. */
export function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent text-white"
          : "border-border bg-surface text-text-dim hover:bg-surface-2 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
