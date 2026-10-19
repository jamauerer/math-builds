/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createLearnerMap } from "../../../engine/placement";
import { skills } from "../../../data/load-skills";
import { GoatKit } from "./GoatKit";
import type { KitProfile } from "../../../storage/progress";
import type { UnitSystem } from "../../../units";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("location profile", () => {
  it("opens the country picker for a new profile", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <GoatKit map={createLearnerMap(skills)} marks={0} onMarks={() => undefined} units="us" onUnits={() => undefined} start="live" />,
      );
    });
    expect(container.textContent).toContain("Where do you live?");
    expect(container.querySelector("[aria-label='Search countries']")).toBeTruthy();
    expect(container.textContent).toContain("Germany");
    expect(container.textContent).toContain("United States");
    root.unmount();
    container.remove();
  });

  it("shows Klasse for a German profile and US grades for a US profile", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const german: KitProfile = { grade: null, country: "DE", gradeSystem: "europe", levels: {}, history: [], notes: [] };
    await act(async () => {
      root.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="metric"
          onUnits={() => undefined}
          start="grade"
          seedCountry="DE"
          kitProfile={german}
        />,
      );
    });
    expect(container.textContent).toContain("Which Klasse?");
    expect(container.textContent).toContain("Using Klasse");
    expect(container.querySelector("[data-grade-system='europe']")).toBeTruthy();

    const us: KitProfile = { grade: null, country: "US", gradeSystem: "us", levels: {}, history: [], notes: [] };
    await act(async () => {
      root.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units="us"
          onUnits={() => undefined}
          start="grade"
          seedCountry="US"
          kitProfile={us}
        />,
      );
    });
    expect(container.textContent).toContain("What grade are you in?");
    expect(container.textContent).toContain("Using US grades");
    expect(container.querySelector("[data-grade-system='us']")).toBeTruthy();
    root.unmount();
    container.remove();
  });

  it("keeps grade system when units change on the profile", async () => {
    let units: UnitSystem = "metric";
    let profile: KitProfile = {
      grade: 4,
      country: "DE",
      gradeSystem: "europe",
      levels: { measuring: 5, adding: 5, multiplying: 5, dividing: 5, fractions: 5, ratios: 5, geometry: 5, algebra: 5, counting: 5 },
      history: [],
      notes: [],
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    function draw() {
      root.render(
        <GoatKit
          map={createLearnerMap(skills)}
          marks={0}
          onMarks={() => undefined}
          units={units}
          onUnits={(next) => {
            units = next;
          }}
          start="profile"
          kitProfile={profile}
          onKitProfile={(next) => {
            profile = next;
          }}
        />,
      );
    }
    await act(async () => {
      draw();
    });
    expect(container.textContent).toContain("Using Klasse");
    const usUnits = [...container.querySelectorAll("button")].find((button) => button.textContent === "US (feet, pounds)");
    await act(async () => {
      usUnits?.click();
      draw();
    });
    expect(units).toBe("us");
    expect(profile.gradeSystem).toBe("europe");
    expect(container.textContent).toContain("Using Klasse");

    const usGrades = [...container.querySelectorAll("button")].find((button) => button.textContent === "US grades");
    await act(async () => {
      usGrades?.click();
      draw();
    });
    expect(units).toBe("us");
    expect(profile.gradeSystem).toBe("us");
    expect(container.textContent).toContain("Using US grades");
    root.unmount();
    container.remove();
  });
});
