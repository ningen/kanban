import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MONTH_NAMES,
  monthGrid,
  parseDate,
  shiftMonth,
  todayValue,
  WEEKDAYS,
} from "../../lib/calendar";
import { cn } from "../../lib/cn";
import { type PopoverPosition, popoverPosition } from "../../lib/popover";
import { Button } from "./Button";
import { fieldControl, fieldLabel } from "./fieldStyles";

interface DateFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** A polished date picker: a read-only field that opens a month calendar. */
export function DateField({ label, value, onChange, placeholder }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  const [view, setView] = useState<[number, number]>(
    selected ? [selected.getFullYear(), selected.getMonth()] : todayYearMonth(),
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const grid = monthGrid(view[0], view[1]);
  const today = todayValue();

  // The panel is portalled to the body: the modal's sidebar is a scroll
  // container, so an absolutely-positioned panel would be clipped by it. Fixed
  // positioning against the trigger's viewport rect keeps the whole calendar
  // visible, and re-measuring on scroll/resize keeps it glued to the field.
  // `grid.length` is not read inside the effect, but the row count it implies
  // changes the panel's height, which is exactly what needs re-measuring.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the month grid changes height
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      const content = contentRef.current;
      if (trigger === null || panel === null || content === null) {
        return;
      }
      // Height comes from the inner wrapper: the panel itself may already be
      // height-capped, and measuring that would ratchet the cap down on every
      // reposition. Its rect excludes the panel's borders, so add them back.
      const border = panel.offsetHeight - panel.clientHeight;
      setPosition(
        popoverPosition({
          anchor: trigger.getBoundingClientRect(),
          panel: {
            width: panel.getBoundingClientRect().width,
            height: content.getBoundingClientRect().height + border,
          },
          viewport: { width: window.innerWidth, height: window.innerHeight },
        }),
      );
    };
    place();
    // Capture so scrolls inside the modal (not just the window) reposition it.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, grid.length]);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // The panel lives in a portal, so it is not inside `wrapRef`.
      if (wrapRef.current?.contains(target) === true) return;
      if (panelRef.current?.contains(target) === true) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && <span className={fieldLabel}>{label}</span>}
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            fieldControl,
            "flex items-center justify-between text-left",
            value.length === 0 && "text-text-faint",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label ?? "日付を選択"}
        >
          <span>{value.length > 0 ? formatHuman(value) : (placeholder ?? "日付を選択")}</span>
          <CalendarIcon />
        </button>

        {open &&
          createPortal(
            <div
              ref={panelRef}
              className="fixed z-30 w-[280px] overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
              style={
                position === null
                  ? { top: 0, left: 0, visibility: "hidden" }
                  : { top: position.top, left: position.left, maxHeight: position.maxHeight }
              }
            >
              <div className="p-3" ref={contentRef}>
                <div className="flex items-center justify-between px-1 pb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="前の月"
                    onClick={() => setView(shiftMonth(view[0], view[1], -1))}
                  >
                    <ChevronIcon dir="left" />
                  </Button>
                  <span className="text-sm font-medium">
                    {MONTH_NAMES[view[1] ?? 0]} {view[0]}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="次の月"
                    onClick={() => setView(shiftMonth(view[0], view[1], 1))}
                  >
                    <ChevronIcon dir="right" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-y-1">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w}
                      className="py-1 text-center text-[11px] font-medium text-text-faint"
                    >
                      {w}
                    </div>
                  ))}
                  {grid.map((day, i) => {
                    if (day === "") {
                      // biome-ignore lint/suspicious/noArrayIndexKey: leading blanks are static placeholders, never reordered
                      return <div key={`blank-${i}`} />;
                    }
                    const isSelected = day === value;
                    const isToday = day === today;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          onChange(day);
                          setOpen(false);
                        }}
                        className={cn(
                          "mx-auto flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
                          isSelected ? "bg-accent text-white" : "text-text hover:bg-surface-2",
                          isToday && !isSelected && "font-semibold text-accent",
                        )}
                      >
                        {Number(day.slice(-2))}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                  <button
                    type="button"
                    className="text-xs text-accent hover:underline"
                    onClick={() => onChange(today)}
                  >
                    Today
                  </button>
                  {value.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-text-faint hover:text-text"
                      onClick={() => {
                        onChange("");
                        setOpen(false);
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}

function todayYearMonth(): [number, number] {
  const d = new Date();
  return [d.getFullYear(), d.getMonth()];
}

function formatHuman(value: string): string {
  const d = parseDate(value);
  if (!d) return value;
  // e.g. "Sep 4, 2026" (short, en). Localized day names not required for MVP.
  const s = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  return s;
}

function CalendarIcon() {
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
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6h12M5 1.5V4M11 1.5V4" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  const d = dir === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5";
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
