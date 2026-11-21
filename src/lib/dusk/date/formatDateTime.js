import { formatTime } from "@dusk-network/networks/format";

/**
 * A date and time as `@dusk-network/networks/format` writes them for every
 * Dusk app: in English words, on the viewer's clock, in their time zone
 * with its short name. A record leaves out the weekday that format leads
 * with: "26 Oct 2026, 11:30:49 AM CET". The explorer keeps the seconds of a
 * block's or a transaction's own time, and leaves them out of an estimate;
 * an estimate a day is precise enough for is the date alone, "26 Oct 2026".
 *
 * @param {Date} date
 * @param {{ seconds?: boolean, time?: boolean, locale?: string, timeZone?: string }} [options]
 *   `locale` and `timeZone` are other than the viewer's
 * @returns {string}
 */
const formatDateTime = (
  date,
  { seconds = true, time = true, locale, timeZone } = {},
) => {
  const written = formatTime(date, {
    date: "full",
    locale,
    seconds,
    timeZone,
  }).replace(/^\p{L}+\.?,?\s+/u, "");

  return time ? written : written.slice(0, written.indexOf(","));
};

export default formatDateTime;
