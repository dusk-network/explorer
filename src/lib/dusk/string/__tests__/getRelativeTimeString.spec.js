import { afterEach, describe, expect, it, vi } from "vitest";
import { getRelativeTimeString } from "../";

describe("getRelativeTimeString", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return the correct relative time", () => {
    const date = new Date();
    expect(getRelativeTimeString(date, "long")).toBe("now");

    date.setDate(date.getDate() - 2);
    expect(getRelativeTimeString(date, "long")).toBe("2 days ago");

    date.setDate(date.getDate() - 7);
    expect(getRelativeTimeString(date, "long")).toBe("last week");

    date.setDate(date.getDate() - 7);
    expect(getRelativeTimeString(date, "long")).toBe("2 weeks ago");

    date.setDate(date.getDate() - 15);
    expect(getRelativeTimeString(date, "long")).toBe("last month");

    date.setDate(date.getDate() - 40);
    expect(getRelativeTimeString(date, "long")).toBe("2 months ago");

    date.setDate(date.getDate() - 300);
    expect(getRelativeTimeString(date, "long")).toBe("last year");

    date.setDate(date.getDate() - 365);
    expect(getRelativeTimeString(date, "long")).toBe("2 years ago");
  });

  it("should give a count that rounds up to the next unit in that unit", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 12) });

    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;

    /** @param {number} ms */
    const ago = (ms) =>
      getRelativeTimeString(new Date(Date.now() - ms), "long");

    expect(ago(59.4 * SECOND)).toBe("59 seconds ago");
    expect(ago(59.6 * SECOND)).toBe("1 minute ago");
    expect(ago(60 * SECOND)).toBe("1 minute ago");
    expect(ago(59 * MINUTE + 20 * SECOND)).toBe("59 minutes ago");
    expect(ago(59 * MINUTE + 40 * SECOND)).toBe("1 hour ago");
    expect(ago(23 * HOUR + 20 * MINUTE)).toBe("23 hours ago");
    expect(ago(23 * HOUR + 40 * MINUTE)).toBe("yesterday");
    expect(ago(6.4 * DAY)).toBe("6 days ago");
    expect(ago(6.6 * DAY)).toBe("last week");
    expect(ago(29 * DAY)).toBe("4 weeks ago");

    // Ahead as well as behind.
    expect(
      getRelativeTimeString(new Date(Date.now() + 59.6 * SECOND), "long")
    ).toBe("in 1 minute");
  });
});
