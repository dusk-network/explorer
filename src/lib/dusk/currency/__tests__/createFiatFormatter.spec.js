import { describe, expect, it } from "vitest";

import { createFiatFormatter } from "..";

describe("createFiatFormatter", () => {
  const formatter = createFiatFormatter("en-US", "USD");

  it("should round fiat values to cents", () => {
    expect(formatter(202.48525)).toBe("$202.49");
    expect(formatter(0.0552255)).toBe("$0.06");
    expect(formatter(1_234_567)).toBe("$1,234,567.00");
    expect(formatter(0)).toBe("$0.00");
  });

  it("should say a value is under a cent instead of showing $0.00", () => {
    expect(formatter(0.000207728)).toBe("< $0.01");
    expect(formatter(0.0000000001)).toBe("< $0.01");
  });
});
