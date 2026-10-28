/**
 * A date and time in the viewer's time zone, with the zone's short name, as
 * the bridge writes it: "Mon 26 Oct 2026, 11:30:49 CET", or without the
 * seconds for a time that is only estimated.
 *
 * @param {Date} date
 * @param {{ seconds?: boolean, timeZone?: string }} [options] `timeZone`
 *   is a zone other than the viewer's
 * @returns {string}
 */
function formatDateTime(date, { seconds = true, timeZone } = {}) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "short",
      ...(seconds ? { second: "2-digit" } : {}),
      timeZone,
      timeZoneName: "short",
      weekday: "short",
      year: "numeric",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  const time = `${parts.hour}:${parts.minute}${seconds ? `:${parts.second}` : ""}`;

  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${time} ${parts.timeZoneName}`;
}

export default formatDateTime;
