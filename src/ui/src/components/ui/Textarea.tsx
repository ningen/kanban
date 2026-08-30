import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn";
import { fieldControl, fieldLabel } from "./fieldStyles";

export interface TextareaProps extends ComponentPropsWithoutRef<"textarea"> {
  label?: string;
  error?: string;
}

/** Labeled textarea with consistent focus/error styling. */
export function Textarea({ label, error, className, id, ...rest }: TextareaProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label htmlFor={inputId} className={fieldLabel}>
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(fieldControl, "resize-y", error !== undefined && "border-danger", className)}
        aria-invalid={error !== undefined}
        {...rest}
      />
      {error !== undefined && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
