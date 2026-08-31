import { describe, expect, it } from "bun:test";
import { type PopoverGeometry, popoverPosition } from "./popover";

/** A 280x345 calendar panel (the real `DateField` size). */
const PANEL = { width: 280, height: 345 };
/** A 179px trigger near the right edge — the task modal's Due field. */
const ANCHOR = { top: 226, left: 860, width: 179, height: 38 };
const VIEWPORT = { width: 1280, height: 800 };

function place(overrides: Partial<PopoverGeometry> = {}) {
  return popoverPosition({ anchor: ANCHOR, panel: PANEL, viewport: VIEWPORT, ...overrides });
}

describe("popoverPosition", () => {
  it("places the panel below the trigger when there is room", () => {
    const pos = place();
    expect(pos.side).toBe("bottom");
    expect(pos.top).toBe(226 + 38 + 8);
    expect(pos.left).toBe(860);
    expect(pos.maxHeight).toBe(345);
  });

  it("keeps the panel inside the right edge of the viewport", () => {
    // The regression: a 280px panel on a 179px trigger in the right sidebar
    // used to hang 81px past its scroll container and get clipped.
    const pos = place({ viewport: { width: 960, height: 800 } });
    expect(pos.left).toBe(960 - 8 - 280);
    expect(pos.left + PANEL.width).toBeLessThanOrEqual(960 - 8);
  });

  it("keeps the panel inside the left edge of the viewport", () => {
    const pos = place({ anchor: { top: 100, left: -40, width: 179, height: 38 } });
    expect(pos.left).toBe(8);
  });

  it("flips above the trigger when only the top has room", () => {
    const anchor = { top: 400, left: 200, width: 179, height: 38 };
    const pos = place({ anchor, viewport: { width: 1280, height: 520 } });
    expect(pos.side).toBe("top");
    expect(pos.top + pos.maxHeight).toBeLessThanOrEqual(anchor.top - 8);
  });

  it("caps the height to the roomier side when neither side fits", () => {
    const pos = place({ viewport: { width: 1280, height: 420 } });
    expect(pos.maxHeight).toBeLessThan(PANEL.height);
    // Capped to the room below, so the panel still ends inside the viewport.
    expect(pos.top + pos.maxHeight).toBeLessThanOrEqual(420 - 8);
  });

  it("never shrinks the panel below the minimum height", () => {
    // Trigger pinned to the bottom of a very short viewport: no room either way.
    const anchor = { top: 300, left: 200, width: 179, height: 38 };
    const pos = place({ anchor, viewport: { width: 1280, height: 340 } });
    expect(pos.maxHeight).toBeGreaterThanOrEqual(120);
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  it("honors a custom gap and margin", () => {
    const pos = place({ gap: 0, margin: 0 });
    expect(pos.top).toBe(226 + 38);
  });
});
