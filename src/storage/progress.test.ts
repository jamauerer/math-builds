import { describe, expect, it } from "vitest";
import { skills, strands } from "../data/load-skills";
import { createLearnerMap, createQuizSession, recordLevelPass, snapshotQuiz } from "../engine/placement";
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
  it("round-trips checked levels and an in-progress question", () => {
    let map = createLearnerMap(skills);
    map = recordLevelPass(map, "multiply-facts-2-to-5", 5);
    const session = createQuizSession({ skills, strands, seed: 3, map });
    const store = createProgressStore(skills, memoryStore());
    expect(store.load()).toBeNull();
    store.save({
      map,
      toppedOut: ["multiplication"],
      placement: snapshotQuiz(session),
      history: session.history,
      age: 10,
      ageAsked: true,
      bridgeCompleted: ["candy-1"],
      bridgeEarned: { "candy-1": { chocolate: 4 } },
    });
    expect(store.load()?.age).toBe(10);
    expect(store.load()?.ageAsked).toBe(true);
    expect(store.load()?.bridgeCompleted).toEqual(["candy-1"]);
    expect(store.load()?.bridgeEarned["candy-1"]).toEqual({ chocolate: 4 });
    const loaded = store.load();
    expect(loaded?.map["multiply-facts-2-to-5"]).toEqual({ level: 5, state: "mastered" });
    expect(loaded?.map["hundreds"]).toEqual({ level: 0, state: "unchecked" });
    expect(loaded?.toppedOut).toEqual(["multiplication"]);
    expect(loaded?.placement?.skillId).toBe(session.skillId);
    expect(loaded?.placement?.level).toBe(session.level);
    expect(loaded?.placement?.problem?.prompt).toBe(session.problem?.prompt);
  });
});
