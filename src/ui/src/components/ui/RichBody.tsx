import { useState } from "react";
import { renderMarkdown } from "../../lib/markdown";
import { cn } from "../../lib/cn";
import { fieldLabel } from "./fieldStyles";

export type BodyMode = "write" | "preview";

interface RichBodyProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Obsidian-style body editor: a "write / preview" split that shows either a
 * plain textarea (write) or a rendered Markdown view (preview). Preview is
 * produced by a safe, HTML-escaping Markdown renderer.
 */
export function RichBody({ label, value, onChange, placeholder }: RichBodyProps) {
  const [mode, setMode] = useState<BodyMode>("write");

  return (
    <div className="flex flex-col gap-1.5">
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
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] leading-relaxed text-text placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      ) : (
        <div
          className="md-preview min-h-[8rem] w-full overflow-auto rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
        />
      )}
    </div>
  );
}
