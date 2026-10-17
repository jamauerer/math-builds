/** Compare a typed answer with the computed one. Numeric forms ignore leading zeros. */
export function answersMatch(given: string, expected: string): boolean {
  const typed = given.trim();
  const answer = expected.trim();
  if (typed.length === 0) {
    return false;
  }
  if (typed === answer) {
    return true;
  }
  if (/^\d+$/.test(typed) && /^\d+$/.test(answer)) {
    return Number(typed) === Number(answer);
  }
  return false;
}
