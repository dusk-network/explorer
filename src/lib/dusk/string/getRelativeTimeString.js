/**
 * @typedef {Object} TimeUnit
 * @property {Number} factor
 * @property {Intl.RelativeTimeFormatUnit} name
 */

/** @type {TimeUnit[]} */
const units = [
  { name: "year", factor: 1000 * 60 * 60 * 24 * 365 },
  { name: "month", factor: 1000 * 60 * 60 * 24 * 30 },
  { name: "week", factor: 1000 * 60 * 60 * 24 * 7 },
  { name: "day", factor: 1000 * 60 * 60 * 24 },
  { name: "hour", factor: 1000 * 60 * 60 },
  { name: "minute", factor: 1000 * 60 },
  { name: "second", factor: 1000 },
];

/**
 * The largest unit the difference holds one of, and how many of it, to the
 * nearest. A count that rounds up to the next unit's worth is given in
 * that unit: 59.6 seconds is "1 minute", not "60 seconds".
 *
 * @private
 * @param {Number} diff
 * @returns {[Number, TimeUnit]}
 */
function getCountAndUnit(diff) {
  const index = units.findIndex((unit) => Math.abs(diff) >= unit.factor);
  let unitIndex = index === -1 ? units.length - 1 : index;

  while (
    unitIndex > 0 &&
    Math.round(Math.abs(diff) / units[unitIndex].factor) *
      units[unitIndex].factor >=
      units[unitIndex - 1].factor
  ) {
    unitIndex -= 1;
  }

  const unit = units[unitIndex];

  return [Math.round(diff / unit.factor), unit];
}

/**
 * Each unit as a list writes it, compact: "18 s ago", "40 min ago". One
 * day, week, month or year keeps its words: "yesterday", "last week".
 *
 * @type {Record<string, { short: string, words: boolean }>}
 */
const compactUnits = {
  day: { short: "d", words: true },
  hour: { short: "h", words: false },
  minute: { short: "min", words: false },
  month: { short: "mo", words: true },
  second: { short: "s", words: false },
  week: { short: "wk", words: true },
  year: { short: "y", words: true },
};

/**
 * How long ago, or how soon, in English. "compact" writes the units short,
 * "18 s ago" or "in 3 h", and keeps the words for one day, week, month or
 * year: "yesterday", "last week".
 *
 * @param {Date} date
 * @param {"long" | "short" | "narrow" | "compact"} style
 * @return {String}
 */
function getRelativeTimeString(date, style) {
  const rtf = new Intl.RelativeTimeFormat("en", {
    localeMatcher: "best fit",
    numeric: "auto",
    style: style === "compact" ? "long" : style,
  });
  const [count, unit] = getCountAndUnit(date.getTime() - Date.now());

  const compact = compactUnits[unit.name];

  if (
    style !== "compact" ||
    count === 0 ||
    (Math.abs(count) === 1 && compact.words)
  ) {
    return rtf.format(count, unit.name);
  }

  const amount = `${Math.abs(count)} ${compact.short}`;

  return count < 0 ? `${amount} ago` : `in ${amount}`;
}

export default getRelativeTimeString;
