import { describe, expect, it } from "vitest";

import { gqlTransaction } from "$lib/mock-data";

import { amountSign, directionOf, transformTransaction } from "..";

describe("directionOf", () => {
  const transfer = transformTransaction(gqlTransaction.tx);
  const sender = String(transfer.from);
  const receiver = String(transfer.to);

  it("should say which way a transaction went for an account", () => {
    expect(directionOf(transfer, sender)).toBe("out");
    expect(directionOf(transfer, receiver)).toBe("in");
    // The node leaves the receiver out when it is the sender.
    expect(directionOf({ ...transfer, to: null }, sender)).toBe("self");
  });

  it("should give no way without an account, or for one not in it", () => {
    expect(directionOf(transfer, undefined)).toBeUndefined();
    expect(directionOf(transfer, "someone else")).toBeUndefined();
  });
});

describe("amountSign", () => {
  it("should sign what came in and what went out", () => {
    expect(amountSign("in", 1, false)).toBe("+");
    expect(amountSign("out", 1, false)).toBe("−");
  });

  it("should leave unsigned what went to itself, nothing, or a failure", () => {
    expect(amountSign("self", 1, false)).toBe("");
    expect(amountSign(undefined, 1, false)).toBe("");
    expect(amountSign("out", 0, false)).toBe("");
    expect(amountSign("in", 1, true)).toBe("");
  });
});
