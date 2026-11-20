/**
 * A figure, as part of a pattern that finds it whole: no digit, separator
 * or sign runs into it on either side. So "1,123,120" isn't "123,120",
 * "+1" isn't "1", and "5,000,000,000,000" isn't "5,000,000,000". A sign is
 * part of the figure: give one to expect one.
 *
 * @param {string} value As shown, e.g. "123,120", "−8.05%" or "12.7%"
 * @returns {string} A pattern's source
 */
const figure = (value) =>
  `(?<![\\d.,+−-])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![.,]?\\d)`;

export default figure;
