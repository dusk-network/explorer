import { describe, expect, it } from "vitest";

import { shortId } from "..";

describe("shortId", () => {
  it("should keep an account's or a hash's first and last six characters, in their case", () => {
    expect(
      shortId(
        "qxwSidLBa1rJ74ngfP4GUCaNsAYjMboDPHzbmiVEMmNNK26hVkYe8QccH6ipYdVRsUDnx9QS1KBeu8ZoMDFpXJJE6YCcHy2AykvJ7eEAGc7PGDgCZFV5YJBxzukADkQ2Bgr",
      ),
    ).toBe("qxwSid…kQ2Bgr");
    expect(
      shortId(
        "4877687c2dbf154248d3ddee9ba0d81e3431f39056f82a46819da041d4ac0e04",
      ),
    ).toBe("487768…ac0e04");
  });

  it("should keep a value too short to shorten whole", () => {
    expect(shortId("abc123")).toBe("abc123");
  });
});
