export const POOL = 80;
export const PICKED = 20;

export function parseNumberList(text: string): number[] {
  return text
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((s) => parseInt(s, 10));
}

/** Returns an error message, or null when the draw is valid. */
export function validateDraw(numbers: number[], bonus: number | null): string | null {
  if (numbers.length !== PICKED) {
    return `Enter exactly ${PICKED} numbers (you entered ${numbers.length}).`;
  }
  if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > POOL)) {
    return `Every number must be between 1 and ${POOL}.`;
  }
  if (new Set(numbers).size !== PICKED) {
    return "Numbers can't repeat within a draw.";
  }
  if (bonus !== null && (!Number.isInteger(bonus) || bonus < 1 || bonus > POOL)) {
    return `Bonus must be between 1 and ${POOL}.`;
  }
  return null;
}
