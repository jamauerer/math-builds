import { describe, expect, it } from "vitest";
import { skills } from "../data/load-skills";
import { createLearnerMap, recordLevelPass } from "../engine/placement";
import { createProgressStore } from "./progress";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("progress storage", () => {
  it("round-trips the highest level passed", () => {
    let map = createLearnerMap(skills);
    map = recordLevelPass(map, "multiply-facts-2-to-5", 5);
    const store = createProgressStore(skills, memoryStore());
    expect(store.load()).toBeNull();
    store.save({ map, toppedOut: ["multiplication"] });
    const loaded = store.load();
    expect(loaded?.map["multiply-facts-2-to-5"]).toEqual({ level: 5, state: "solid" });
    expect(loaded?.map["hundreds"]).toEqual({ level: 0, state: "unknown" });
    expect(loaded?.toppedOut).toEqual(["multiplication"]);
  });
});
