/**
 * Viewport-anchored positioning for popovers.
 *
 * A panel rendered inside a scroll container (the task modal's metadata
 * sidebar, for example) is clipped by that container's overflow, no matter how
 * it is aligned. The escape hatch is to portal the panel to `document.body` and
 * give it `position: fixed`, then place it against the trigger's viewport rect
 * — flipping and clamping so it never falls outside the viewport.
 *
 * The geometry is pure and tested here; the DOM wiring lives in the component.
 */

/** A rect in viewport coordinates, as returned by `getBoundingClientRect`. */
export interface PopoverBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PopoverSize {
  width: number;
  height: number;
}

export interface PopoverGeometry {
  /** The trigger's rect, in viewport coordinates. */
  anchor: PopoverBox;
  /** The panel's natural (unconstrained) size. */
  panel: PopoverSize;
  /** The viewport size. */
  viewport: PopoverSize;
  /** Space between the trigger and the panel. Default 8. */
  gap?: number;
  /** Minimum distance kept from the viewport edges. Default 8. */
  margin?: number;
}

export interface PopoverPosition {
  /** Viewport coordinates to apply to a `position: fixed` panel. */
  top: number;
  left: number;
  /** Height the panel may occupy before it scrolls internally. */
  maxHeight: number;
  /** Which side of the trigger the panel ended up on. */
  side: "bottom" | "top";
}

const GAP = 8;
const MARGIN = 8;
/** Floor for `maxHeight`: below this a panel is unusable, so it scrolls instead. */
const MIN_HEIGHT = 120;

/**
 * Place a panel against its trigger, preferring below and flipping above when
 * that is the only side with room. Both axes are clamped to the viewport, and
 * `maxHeight` is capped to the room on the chosen side so a tall panel scrolls
 * internally rather than being cut off.
 */
export function popoverPosition({
  anchor,
  panel,
  viewport,
  gap = GAP,
  margin = MARGIN,
}: PopoverGeometry): PopoverPosition {
  const spaceBelow = viewport.height - margin - (anchor.top + anchor.height) - gap;
  const spaceAbove = anchor.top - gap - margin;
  const side = chooseSide(panel.height, spaceBelow, spaceAbove);
  const room = side === "bottom" ? spaceBelow : spaceAbove;

  const maxHeight = Math.min(panel.height, Math.max(room, MIN_HEIGHT));
  const top = clamp(
    side === "bottom" ? anchor.top + anchor.height + gap : anchor.top - gap - maxHeight,
    margin,
    Math.max(margin, viewport.height - margin - maxHeight),
  );
  const left = clamp(anchor.left, margin, Math.max(margin, viewport.width - margin - panel.width));

  return { top, left, maxHeight, side };
}

function chooseSide(height: number, spaceBelow: number, spaceAbove: number): "bottom" | "top" {
  if (height <= spaceBelow) {
    return "bottom";
  }
  if (height <= spaceAbove) {
    return "top";
  }
  // Neither side fits: take the roomier one.
  return spaceBelow >= spaceAbove ? "bottom" : "top";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
