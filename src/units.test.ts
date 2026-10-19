import { describe, expect, it } from "vitest";
import { defaultUnitSystem, formatLength, formatWeight, lengthName, setUnitSystem } from "./units";

describe("units", () => {
  it("formats the same kit length in feet or meters", () => {
    expect(formatLength(8, "us")).toBe("8 ft");
    expect(formatLength(8, "metric")).toBe("8 m");
    expect(formatWeight(12, "us")).toBe("12 lb");
    expect(formatWeight(12, "metric")).toBe("12 kg");
    expect(lengthName(2, "metric")).toBe("meters");
  });

  it("defaults to US only for an en-US locale", () => {
    expect(defaultUnitSystem("en-US")).toBe("us");
    expect(defaultUnitSystem("en-us")).toBe("us");
    expect(defaultUnitSystem("en-GB")).toBe("metric");
    expect(defaultUnitSystem("fr-FR")).toBe("metric");
    setUnitSystem("metric");
    expect(formatLength(8)).toBe("8 m");
    setUnitSystem("us");
    expect(formatLength(8)).toBe("8 ft");
  });
});
