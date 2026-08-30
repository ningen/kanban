import { lazy, Suspense, useState } from "react";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/cn";
import { fieldLabel } from "./fieldStyles";

export type BodyMode = "write" | "preview";

// react-markdown is loaded only when the Preview tab is opened, so the markdown
// parser doesn't add to the initial bundle.
const Markdown = lazy(() => import("react-markdown"));

interface RichBodyProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra classes applied to the editor wrapper (e.g. to set a min-height). */
  className?: string;
}

/**
 * Obsidian-style body editor: a "write / preview" split that shows either a
 * plain textarea (write) or a rendered Markdown view (preview). Preview uses
 * react-markdown (remark + rehype), which is safe by default and supports
 * GitHub-flavored Markdown (task lists, tables, strikethrough) via remark-gfm.
 */
export function RichBody({ label, value, onChange, placeholder, className }: RichBodyProps) {
  const [mode, setMode] = useState<BodyMode>("write");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between">
        {label !== undefined ? (
          <span className={fieldLabel}>{label}</span>
        ) : (
          <span />
        )}
        <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">
          {(["write", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                mode === m ? "bg-surface-3 text-text" : "text-text-faint hover:text-text",
              )}
              aria-pressed={mode === m}
            >
              {m === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          placeholder={placeholder ?? "Markdown で記述…"}
          className="min-h-[inherit] w-full flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] leading-relaxed text-text placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      ) : (
        <div className="md-preview min-h-[8rem] w-full flex-1 overflow-auto rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          <Suspense fallback={<p className="text-text-faint">Loading preview…</p>}>
            <Markdown remarkPlugins={[remarkGfm]}>{value}</Markdown>
          </Suspense>
        </div>
      )}
    </div>
  );
}
