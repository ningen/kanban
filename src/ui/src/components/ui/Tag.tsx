import { tagHue } from "../../lib/tagColor";

/** Small colored tag pill. Color is deterministic from the tag text. */
export function Tag({ name }: { name: string }) {
  return (
    <span
      className="card__tag rounded-full px-1.5 py-0.5 text-[11px]"
      style={{ ["--tag-hue" as string]: String(tagHue(name)) }}
    >
      {name}
    </span>
  );
}
