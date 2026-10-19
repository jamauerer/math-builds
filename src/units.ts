export type UnitSystem = "us" | "metric";

/** Oak is 12 pounds per foot, or 12 kilograms per meter. The number stays 12. */
export const WEIGHT_PER_LENGTH = 12;

let active: UnitSystem | null = null;

export function defaultUnitSystem(locale?: string): UnitSystem {
  const tag = (locale ?? readLocale()).toLowerCase();
  if (tag === "en-us" || tag.startsWith("en-us-")) {
    return "us";
  }
  return "metric";
}

export function unitSystem(): UnitSystem {
  if (!active) {
    active = defaultUnitSystem();
  }
  return active;
}

export function setUnitSystem(system: UnitSystem): void {
  active = system;
}

export function lengthAbbrev(system: UnitSystem = unitSystem()): "ft" | "m" {
  return system === "us" ? "ft" : "m";
}

export function weightAbbrev(system: UnitSystem = unitSystem()): "lb" | "kg" {
  return system === "us" ? "lb" : "kg";
}

export function lengthName(count = 2, system: UnitSystem = unitSystem()): string {
  if (system === "us") {
    return count === 1 ? "foot" : "feet";
  }
  return count === 1 ? "meter" : "meters";
}

export function weightName(count = 2, system: UnitSystem = unitSystem()): string {
  if (system === "us") {
    return count === 1 ? "pound" : "pounds";
  }
  return count === 1 ? "kilogram" : "kilograms";
}

export function formatLength(value: number, system: UnitSystem = unitSystem()): string {
  return `${trimNumber(value)} ${lengthAbbrev(system)}`;
}

export function formatWeight(value: number, system: UnitSystem = unitSystem()): string {
  return `${trimNumber(value)} ${weightAbbrev(system)}`;
}

export function systemLabel(system: UnitSystem): string {
  return system === "us" ? "US (feet, pounds)" : "Metric (meters, kilograms)";
}

export function systemShort(system: UnitSystem): string {
  return system === "us" ? "US" : "Metric";
}

function trimNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Math.round(value * 100) / 100);
}

function readLocale(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en-US";
}
