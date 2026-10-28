import { describe, expect, it } from "vitest";

import { formatDateTime } from "..";

describe("formatDateTime", () => {
  const date = new Date(Date.UTC(2026, 9, 26, 10, 30, 49));

  it("should write the date and time in the viewer's zone, and name the zone", () => {
    // The tests run in UTC.
    expect(formatDateTime(date)).toBe("Mon 26 Oct 2026, 10:30:49 UTC");
  });

  it("should write it in another zone when given one", () => {
    expect(formatDateTime(date, { timeZone: "Europe/Amsterdam" })).toBe(
      "Mon 26 Oct 2026, 11:30:49 CET"
    );
    expect(formatDateTime(date, { timeZone: "America/New_York" })).toBe(
      "Mon 26 Oct 2026, 06:30:49 GMT-4"
    );
  });

  it("should leave the seconds out when asked", () => {
    expect(formatDateTime(date, { seconds: false })).toBe(
      "Mon 26 Oct 2026, 10:30 UTC"
    );
  });
});
