import { describe, expect, it } from "vitest";

import { hexToText } from "..";

describe("hexToText", () => {
  it("should decode hex that holds UTF-8 text", () => {
    expect(hexToText("73616d2072362077772073656e64")).toBe("sam r6 ww send");
    expect(hexToText("4361666520e298952031")).toBe("Cafe ☕ 1");
    expect(hexToText("6c696e65310a6c696e6532")).toBe("line1\nline2");
  });

  it("should give `null` for bytes that aren't text", () => {
    expect(hexToText("ff00")).toBeNull();
    expect(hexToText("c328")).toBeNull();
    expect(hexToText("0102030405")).toBeNull();
  });

  it("should give `null` for text with control, bidi or zero-width characters", () => {
    const hex = (/** @type {string} */ text) =>
      Array.from(new TextEncoder().encode(text), (b) =>
        b.toString(16).padStart(2, "0")
      ).join("");

    // C1 control (NEL) and right-to-left override
    expect(hexToText("c285")).toBeNull();
    expect(hexToText("e280ae")).toBeNull();
    expect(hexToText(hex("pay \u202Etxt.exe"))).toBeNull();
    expect(hexToText(hex("a\u2066b\u2069"))).toBeNull();
    expect(hexToText(hex("a\u200Bb"))).toBeNull();
    expect(hexToText(hex("a\uFEFFb"))).toBeNull();
    // A leading byte order mark too, which a decoder would drop
    expect(hexToText("efbbbf6869")).toBeNull();
    expect(hexToText(hex("a\u2028b"))).toBeNull();
    expect(hexToText(hex("tab\there\r\nok"))).toBe("tab\there\r\nok");
  });

  it("should give `null` for values that aren't hex", () => {
    expect(hexToText("")).toBeNull();
    expect(hexToText("abc")).toBeNull();
    expect(hexToText("not hex")).toBeNull();
  });
});
