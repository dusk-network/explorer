import { describe, expect, it } from "vitest";

import { formatDateTime } from "..";

describe("formatDateTime", () => {
  const date = new Date(Date.UTC(2026, 9, 26, 10, 30, 49));

  it("should write the date in English words, the time on the viewer's clock, and name the zone", () => {
    // The tests run in UTC, in American English: a 12-hour clock.
    expect(formatDateTime(date)).toBe("Mon 26 Oct 2026, 10:30:49 AM UTC");
    expect(formatDateTime(date, { locale: "en-GB" })).toBe(
      "Mon 26 Oct 2026, 10:30:49 UTC"
    );
  });

  it("should keep the words English on another language's clock", () => {
    expect(
      formatDateTime(date, { locale: "nl-NL", timeZone: "Europe/Amsterdam" })
    ).toBe("Mon 26 Oct 2026, 11:30:49 CET");
  });

  it("should write it in another zone when given one", () => {
    expect(formatDateTime(date, { timeZone: "America/New_York" })).toBe(
      "Mon 26 Oct 2026, 6:30:49 AM EDT"
    );
  });

  it("should leave the seconds out when asked", () => {
    expect(formatDateTime(date, { seconds: false })).toBe(
      "Mon 26 Oct 2026, 10:30 AM UTC"
    );
  });
});
