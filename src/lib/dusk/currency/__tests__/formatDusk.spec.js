import { describe, expect, it } from "vitest";

import { formatDusk, formatDuskExact, formatFee } from "..";

describe("formatDusk", () => {
  it("should show at most four decimals, cut and trimmed, with the thousands grouped", () => {
    expect(formatDusk(1_481_554_712_345)).toBe("1,481.5547");
    expect(formatDusk(500_000_000)).toBe("0.5");
    expect(formatDusk(2_000_000_000)).toBe("2");
    expect(formatDusk(0)).toBe("0");
    expect(formatDusk(-1_234_567_890)).toBe("−1.2345");
  });

  it("should show stakes without float noise", () => {
    // 9,435,908.7 DUSK, which LUX × 1e-9 shows as 9,435,908.700000001
    expect(formatDusk(9_435_908_700_000_000)).toBe("9,435,908.7");
    expect(formatDuskExact(9_435_908_700_000_000)).toBe("9,435,908.7");
    expect(formatDusk("13102790940789549")).toBe("13,102,790.9407");
    expect(formatDuskExact(13_102_790_940_789_549n)).toBe(
      "13,102,790.940789549"
    );
  });

  it("should show two significant digits under 0.01 DUSK, cut, and never show an amount as zero", () => {
    expect(formatDusk(1_853_542)).toBe("0.0018");
    expect(formatDusk(99_999)).toBe("0.000099");
    expect(formatDusk(100_000)).toBe("0.0001");
    expect(formatDusk(1)).toBe("0.000000001");
    expect(formatDuskExact(99_999)).toBe("0.000099999");
  });

  it("should take anything else as zero", () => {
    expect(formatDusk(Number.NaN)).toBe("0");
    expect(formatDusk(undefined)).toBe("0");
    expect(formatDuskExact("not a number")).toBe("0");
  });
});

describe("formatFee", () => {
  it("should round a fee to the nearest, with two significant digits under 0.01 DUSK, as the wallets do", () => {
    expect(formatFee(1_853_542)).toBe("0.0019");
    expect(formatFee(1_849_999)).toBe("0.0018");
    expect(formatFee(12_345_678)).toBe("0.0123");
    expect(formatFee(49_999)).toBe("0.00005");
    expect(formatFee(0)).toBe("0");
  });
});
