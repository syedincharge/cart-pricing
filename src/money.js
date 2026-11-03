/**
 * Money is represented as an integer number of cents everywhere in this
 * project. Floating point dollars are never stored or passed around.
 */

/** Rounds a cent amount to a whole cent, half away from zero. */
export function roundCents(cents) {
  if (!Number.isFinite(cents)) {
    throw new TypeError('cents must be a finite number');
  }
  return cents < 0 ? -Math.round(-cents) : Math.round(cents);
}

/** Clamps a cent amount so it never drops below zero. */
export function clampToZero(cents) {
  return cents < 0 ? 0 : cents;
}

/** Formats a cent amount as a display string, e.g. 1234 -> "$12.34". */
export function formatCents(cents) {
  const negative = cents < 0;
  const absolute = Math.abs(roundCents(cents));
  const dollars = Math.floor(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}$${dollars}.${remainder}`;
}
