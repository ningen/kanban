import { type ComponentPropsWithoutRef, forwardRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { fieldControl, fieldLabel } from "./fieldStyles";

export interface TextFieldProps extends ComponentPropsWithoutRef<"input"> {
  label?: string;
  /** Optional error message shown below the field. */
  error?: string;
  hint?: ReactNode;
}

/** Labeled text input with consistent focus/error styling. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  const controlClassName = cn(fieldControl, error !== undefined && "border-danger", className);
  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label htmlFor={inputId} className={fieldLabel}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={controlClassName}
        aria-invalid={error !== undefined}
        {...rest}
      />
      {error !== undefined ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint !== undefined ? (
        <span className="text-xs text-text-faint">{hint}</span>
      ) : null}
    </div>
  );
});

TextField.displayName = "TextField";
