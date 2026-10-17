import { describe, expect, it } from "vitest";
import { partById } from "./catalog";
import { driveMessage, dropPiece, nextDrivePhase, stockLeft } from "./place";

describe("piece drops", () => {
  it("places a piece on a valid slot and decrements the count", () => {
    const tray = { chocolate: 2 };
    const part = partById("chocolate");
    if (!part) {
      throw new Error("chocolate is missing");
    }
    const dropped = dropPiece([], tray, part.id, part.role, { col: 0, row: 0 });
    expect(dropped.accepted).toBe(true);
    expect(dropped.placed).toEqual([{ col: 0, row: 0, partId: "chocolate" }]);
    expect(stockLeft(tray, dropped.placed, "chocolate")).toBe(1);
  });

  it("returns a piece when the drop is not a valid slot", () => {
    const tray = { cane: 1, chocolate: 1 };
    const cane = partById("cane");
    if (!cane) {
      throw new Error("cane is missing");
    }
    const before = [{ col: 0, row: 0 as const, partId: "chocolate" }];
    const occupied = dropPiece(before, tray, "chocolate", "deck", { col: 0, row: 0 });
    expect(occupied.accepted).toBe(false);
    expect(occupied.placed).toEqual(before);
    const pillarInTheAir = dropPiece([], tray, cane.id, cane.role, { col: 1, row: 1 });
    expect(pillarInTheAir.accepted).toBe(false);
    expect(pillarInTheAir.placed).toEqual([]);
    expect(stockLeft(tray, [], "cane")).toBe(1);
  });
});

describe("drive result", () => {
  it("shows the result only after the drive animation has held its last frame", () => {
    expect(nextDrivePhase("playing", "driving")).toBe("playing");
    expect(driveMessage("playing", "driving", "fell")).toBe("");
    const held = nextDrivePhase("playing", "crossed");
    expect(held).toBe("holding");
    expect(driveMessage(held, "crossed", "fell")).toBe("");
    const done = nextDrivePhase(held, "crossed");
    expect(done).toBe("result");
    expect(driveMessage(done, "crossed", "fell")).toBe("The car crossed. This bridge is complete.");
    const failed = nextDrivePhase(nextDrivePhase("playing", "collapsed"), "collapsed");
    expect(driveMessage(failed, "collapsed", "The wafer block was too weak for the car. Add a pillar under it.")).toContain(
      "wafer",
    );
  });
});
