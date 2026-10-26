/**
 * DUSK as the explorer shows it, the wallets' one number format: lists and
 * summaries show at most four decimals, the rest cut and trailing zeros
 * trimmed; details and hover texts show every decimal. Counted in LUX, as
 * integers, so no amount picks up float noise.
 *
 * Every function takes LUX, as a number, a bigint or a string of digits.
 */

/** Decimals an amount shows in lists and summaries. */
export const DUSK_DISPLAY_DECIMALS = 4;

const LUX_DECIMALS = 9;
const LUX_PER_DUSK = 10n ** BigInt(LUX_DECIMALS);
const STEP = 10n ** BigInt(LUX_DECIMALS - DUSK_DISPLAY_DECIMALS);
const STEPS_PER_DUSK = LUX_PER_DUSK / STEP;

const wholeFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 0,
});

/** @param {bigint | number | string | null | undefined} value */
function toLux(value) {
  try {
    return BigInt(
      typeof value === "number" ? Math.trunc(value) : String(value ?? 0)
    );
  } catch {
    return 0n;
  }
}

/**
 * @param {boolean} negative
 * @param {bigint} whole
 * @param {string} fraction
 */
const written = (negative, whole, fraction) =>
  `${negative ? "-" : ""}${wholeFormatter.format(whole)}${fraction ? `.${fraction}` : ""}`;

/**
 * Units of an amount as whole DUSK and its decimals, trailing zeros
 * trimmed.
 *
 * @param {boolean} negative
 * @param {bigint} units
 * @param {bigint} perDusk Units in one DUSK
 * @param {number} decimals
 */
const fromUnits = (negative, units, perDusk, decimals) =>
  written(
    negative,
    units / perDusk,
    (units % perDusk).toString().padStart(decimals, "0").replace(/0+$/, "")
  );

/**
 * An amount exactly: every decimal it has, thousands grouped.
 *
 * @param {bigint | number | string | null | undefined} value LUX
 * @returns {string}
 */
export function formatDuskExact(value) {
  const lux = toLux(value);

  return fromUnits(lux < 0n, lux < 0n ? -lux : lux, LUX_PER_DUSK, 9);
}

/**
 * An amount in a list or a summary: at most four decimals, the rest cut,
 * trailing zeros trimmed, thousands grouped. One that would show as zero
 * shows in full.
 *
 * @param {bigint | number | string | null | undefined} value LUX
 * @returns {string}
 */
export function formatDusk(value) {
  const lux = toLux(value);
  const abs = lux < 0n ? -lux : lux;
  const units = abs / STEP;

  return units === 0n && abs !== 0n
    ? formatDuskExact(lux)
    : fromUnits(lux < 0n, units, STEPS_PER_DUSK, DUSK_DISPLAY_DECIMALS);
}

/**
 * A fee paid, in a list: four decimals at most, rounded to the nearest,
 * half up. A fee too small for four decimals shows in full.
 *
 * @param {bigint | number | string | null | undefined} value LUX
 * @returns {string}
 */
export function formatFee(value) {
  const lux = toLux(value);

  if (lux <= 0n) {
    return "0";
  }

  const units = (lux + STEP / 2n) / STEP;

  return units === 0n
    ? formatDuskExact(lux)
    : fromUnits(false, units, STEPS_PER_DUSK, DUSK_DISPLAY_DECIMALS);
}
