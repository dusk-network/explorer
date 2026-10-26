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

  it("should give `null` for values that aren't hex", () => {
    expect(hexToText("")).toBeNull();
    expect(hexToText("abc")).toBeNull();
    expect(hexToText("not hex")).toBeNull();
  });
});
