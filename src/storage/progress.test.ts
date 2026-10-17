import { describe, expect, it } from "vitest";
import { skills } from "../data/load-skills";
import { recordAnswer, createLearnerMap } from "../engine/placement";
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
  it("round-trips learner state through a key-value store", () => {
    let map = createLearnerMap(skills);
    map = recordAnswer(map, "multiply-facts-2-to-5", true);
    map = recordAnswer(map, "multiply-facts-2-to-5", true);
    const store = createProgressStore(skills, memoryStore());
    expect(store.load()).toBeNull();
    store.save(map);
    const loaded = store.load();
    expect(loaded?.["multiply-facts-2-to-5"].state).toBe("solid");
    expect(loaded?.["hundreds"].state).toBe("unknown");
  });
});
