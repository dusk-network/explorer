/**
 * @typedef {Object} TimeUnit
 * @property {Number} factor
 * @property {Intl.RelativeTimeFormatUnit} name
 */

/* eslint-disable sort-keys */

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

/* eslint-enable sort-keys */

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
 * @param {Date} date
 * @param {"long" | "short" | "narrow"} style
 * @return {String}
 */
function getRelativeTimeString(date, style) {
  const rtf = new Intl.RelativeTimeFormat("en", {
    localeMatcher: "best fit",
    numeric: "auto",
    style,
  });
  const [count, unit] = getCountAndUnit(date.getTime() - Date.now());

  return rtf.format(count, unit.name);
}

export default getRelativeTimeString;
