/** Join class names, dropping falsy values. Lightweight clsx/dedupe. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  const out: string[] = [];
  for (const part of parts) {
    if (typeof part === "string" && part.length > 0) out.push(part);
  }
  return out.join(" ");
}
