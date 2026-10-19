import { describe, expect, it } from "vitest";
import { defaultsForCountry, gradeSystemLabel } from "./countries";
import { blankKitProfile, profileGradeSystem, sanitizeProgress } from "../storage/progress";
import { skills } from "../data/load-skills";

describe("location defaults", () => {
  it("gives Germany metric units and Klasse", () => {
    const germany = defaultsForCountry("DE");
    expect(germany.units).toBe("metric");
    expect(germany.gradeSystem).toBe("europe");
    expect(gradeSystemLabel(germany.gradeSystem)).toBe("Klasse");
  });

  it("gives the United States US units and US grades", () => {
    const us = defaultsForCountry("US");
    expect(us.units).toBe("us");
    expect(us.gradeSystem).toBe("us");
    expect(gradeSystemLabel(us.gradeSystem)).toBe("US grades");
  });

  it("keeps Liberia on US customary units with Klasse grades", () => {
    const liberia = defaultsForCountry("LR");
    expect(liberia.units).toBe("us");
    expect(liberia.gradeSystem).toBe("europe");
  });

  it("keeps grade system when units change, and units when grade system changes", () => {
    const germany = {
      ...blankKitProfile(),
      country: "DE",
      gradeSystem: "europe" as const,
      grade: 3,
    };
    expect(profileGradeSystem(germany)).toBe("europe");
    const afterUnits = sanitizeProgress(skills, {
      units: "us",
      kitProfile: { ...germany, gradeSystem: "europe" },
    });
    expect(afterUnits.units).toBe("us");
    expect(profileGradeSystem(afterUnits.kitProfile)).toBe("europe");

    const us = {
      ...blankKitProfile(),
      country: "US",
      gradeSystem: "us" as const,
      grade: 3,
    };
    const afterGrades = sanitizeProgress(skills, {
      units: "us",
      kitProfile: { ...us, gradeSystem: "europe" },
    });
    expect(afterGrades.units).toBe("us");
    expect(profileGradeSystem(afterGrades.kitProfile)).toBe("europe");
  });
});
