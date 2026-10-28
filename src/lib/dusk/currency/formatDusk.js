/**
 * DUSK as the explorer shows it, as `@dusk-network/networks/format` writes
 * it for every Dusk app: lists and summaries show at most four decimals,
 * but two significant digits under 0.01 DUSK, the rest cut and trailing
 * zeros trimmed; fees paid round to the nearest; details and hover texts
 * show every decimal. The numbers are written in English, as the
 * explorer's others are.
 *
 * Every function takes LUX, as a number, a bigint or a string of digits.
 */

import { formatDusk as format } from "@dusk-network/networks/format";

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
 * @param {bigint | number | string | null | undefined} value LUX
 * @param {"down" | "nearest"} round
 */
const short = (value, round) =>
  format(toLux(value), { locale: "en", round }).text;

/**
 * An amount exactly: every decimal it has, thousands grouped.
 *
 * @param {bigint | number | string | null | undefined} value LUX
 * @returns {string}
 */
export const formatDuskExact = (value) =>
  format(toLux(value), { locale: "en", mode: "exact" }).text;

/**
 * An amount in a list or a summary, cut: never more than there is.
 *
 * @param {bigint | number | string | null | undefined} value LUX
 * @returns {string}
 */
export const formatDusk = (value) => short(value, "down");

/**
 * A fee paid, in a list: rounded to the nearest, as the wallets show it.
 *
 * @param {bigint | number | string | null | undefined} value LUX
 * @returns {string}
 */
export const formatFee = (value) => short(value, "nearest");
