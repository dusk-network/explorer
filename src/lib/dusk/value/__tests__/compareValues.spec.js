import { describe, expect, it } from "vitest";

import { compareValues } from "..";

describe("compareValues", () => {
  it.each([
    [1, 2],
    [-2, -1],
    [0, 9007199254740991],
    [9007199254740992n, 9007199254740993n],
    [9007199254740991, 9007199254740992n],
    [13102790940789547n, 14927768807078791n],
    [18446744073709551614n, 18446744073709551615n],
    [-9007199254740993n, 0],
  ])("should put %s before %s, and after it the other way", (less, more) => {
    expect(compareValues(less, more)).toBe(-1);
    expect(compareValues(more, less)).toBe(1);
  });

  it.each([
    [0, 0],
    [0, 0n],
    [9007199254740993n, 9007199254740993n],
    [9007199254740991, 9007199254740991n],
  ])("should keep %s and %s in their order", (a, b) => {
    expect(compareValues(a, b)).toBe(0);
  });

  it("should sort stakes a LUX apart past 2^53, which numbers can't tell apart", () => {
    const stakes = [
      9007199254740993n,
      18446744073709551615n,
      9007199254740992n,
      42,
      14927768807078791n,
    ];

    expect(stakes.toSorted(compareValues)).toStrictEqual([
      42,
      9007199254740992n,
      9007199254740993n,
      14927768807078791n,
      18446744073709551615n,
    ]);
  });
});
