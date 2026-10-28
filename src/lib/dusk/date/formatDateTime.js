import { formatTime } from "@dusk-network/networks/format";

/**
 * A date and time as `@dusk-network/networks/format` writes them for every
 * Dusk app: in English words, on the viewer's clock, in their time zone
 * with its short name, "Mon 26 Oct 2026, 11:30:49 AM CET". The explorer
 * keeps the seconds of a block's or a transaction's own time, and leaves
 * them out of an estimate.
 *
 * @param {Date} date
 * @param {{ seconds?: boolean, locale?: string, timeZone?: string }} [options]
 *   `locale` and `timeZone` are other than the viewer's
 * @returns {string}
 */
const formatDateTime = (date, { seconds = true, locale, timeZone } = {}) =>
  formatTime(date, { date: "full", locale, seconds, timeZone });

export default formatDateTime;
