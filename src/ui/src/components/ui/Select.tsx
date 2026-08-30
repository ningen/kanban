import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn";
import { fieldControl, fieldLabel } from "./fieldStyles";

export interface SelectProps extends ComponentPropsWithoutRef<"select"> {
  label?: string;
}

/** Labeled native select with consistent focus styling. */
export function Select({ label, className, id, children, ...rest }: SelectProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label htmlFor={inputId} className={fieldLabel}>
          {label}
        </label>
      )}
      <select id={inputId} className={cn(fieldControl, className)} {...rest}>
        {children}
      </select>
    </div>
  );
}
