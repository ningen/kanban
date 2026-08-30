import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { fieldControl, fieldLabel } from "./fieldStyles";
import {
  MONTH_NAMES,
  WEEKDAYS,
  monthGrid,
  parseDate,
  shiftMonth,
  todayValue,
} from "../../lib/calendar";
import { Button } from "./Button";

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
  const grid = monthGrid(view[0], view[1]);
  const today = todayValue();

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
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

        {open && (
          <div className="absolute left-0 top-full z-20 mt-2 w-[280px] rounded-lg border border-border bg-surface p-3 shadow-lg">
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
                <div key={w} className="py-1 text-center text-[11px] font-medium text-text-faint">
                  {w}
                </div>
              ))}
              {grid.map((day, i) => {
                if (day === "") return <div key={`b-${i}`} />;
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
                      isSelected
                        ? "bg-accent text-white"
                        : "text-text hover:bg-surface-2",
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
  const s = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
  return s;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6h12M5 1.5V4M11 1.5V4" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  const d = dir === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5";
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
