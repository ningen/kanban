import { describe, expect, it } from "bun:test";
import { dueUrgency, dueUrgencyLabel } from "./dueUrgency";

const clock = { today: "2026-08-30" };

describe("dueUrgency", () => {
  it("classifies overdue dates as overdue", () => {
    expect(dueUrgency("2026-08-29", clock)).toBe("overdue");
    expect(dueUrgency("2026-08-01", clock)).toBe("overdue");
  });

  it("classifies dates within the soon window as due-soon", () => {
    expect(dueUrgency("2026-08-30", clock)).toBe("due-soon");
    expect(dueUrgency("2026-09-01", clock)).toBe("due-soon");
    expect(dueUrgency("2026-09-02", clock)).toBe("due-soon");
  });

  it("respects the DUE_SOON_DAYS bound", () => {
    // 08-30 is day 0; exactly DUE_SOON_DAYS ahead (09-02) is "due-soon".
    expect(dueUrgency("2026-09-02", clock)).toBe("due-soon");
    // one day past the window (09-03) is "normal"
    expect(dueUrgency("2026-09-03", clock)).toBe("normal");
  });

  it("treats far-future and missing due dates as normal", () => {
    expect(dueUrgency("2026-10-01", clock)).toBe("normal");
    expect(dueUrgency(undefined, clock)).toBe("normal");
  });

  it("treats unparseable due dates as normal", () => {
    expect(dueUrgency("not-a-date", clock)).toBe("normal");
  });
});

describe("dueUrgencyLabel", () => {
  it("maps urgency to a human label", () => {
    expect(dueUrgencyLabel("2026-08-20", clock)).toBe("期限超過");
    expect(dueUrgencyLabel("2026-09-01", clock)).toBe("期限間近");
    expect(dueUrgencyLabel("2026-10-01", clock)).toBeNull();
    expect(dueUrgencyLabel(undefined, clock)).toBeNull();
  });
});
