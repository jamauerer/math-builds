/** Compare a typed answer with the computed one. */
export function answersMatch(given: string, expected: string): boolean {
  const typed = given.trim();
  const answer = expected.trim();
  if (typed.length === 0) {
    return false;
  }
  if (typed === answer) {
    return true;
  }
  const left = canonicalNumber(typed);
  const right = canonicalNumber(answer);
  if (left == null || right == null) {
    return false;
  }
  return left === right;
}

/**
 * Digits only, after spaces and thousands commas are removed.
 * Leading zeros do not change the value, so "05" matches "5".
 */
export function canonicalNumber(value: string): string | null {
  const compact = value.trim().replace(/[\s,]/g, "");
  if (!/^\d+$/.test(compact)) {
    return null;
  }
  const stripped = compact.replace(/^0+(?=\d)/, "");
  return stripped;
}

export function responseConflicts(
  verdict: "right" | "wrong" | "skip",
  given: string,
  answer: string,
): boolean {
  return verdict === "wrong" && answersMatch(given, answer);
}
