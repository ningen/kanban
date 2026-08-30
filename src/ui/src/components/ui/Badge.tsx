import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type BadgeVariant = "neutral" | "accent" | "danger" | "warning" | "status";

const base =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
  "focus-visible:outline-none";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-3 text-text-dim",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  warning: "bg-status-waiting-soft text-status-waiting",
  status: "",
};

export interface BadgeProps extends Omit<ComponentPropsWithoutRef<"span">, "color"> {
  variant?: BadgeVariant;
  /** Set when variant="status" to apply the status tone. */
  tone?: string;
  children?: ReactNode;
}

/** Generic pill/badge primitive. Use StatusBadge for status-specific tints. */
export function Badge({ variant = "neutral", tone, className, children, ...rest }: BadgeProps) {
  const style =
    variant === "status" && tone !== undefined
      ? { background: `var(${tone}-soft)`, color: `var(${tone})` }
      : undefined;
  return (
    <span className={cn(base, variants[variant], className)} style={style} {...rest}>
      {children}
    </span>
  );
}
