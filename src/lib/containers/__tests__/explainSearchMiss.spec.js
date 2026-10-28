import { describe, expect, it } from "vitest";

import * as base58 from "$lib/utils/encoders/base58";

import explainSearchMiss from "../search-field/explainSearchMiss";

describe("explainSearchMiss", () => {
  it("should say there is no such block or transaction", () => {
    expect(explainSearchMiss("99999999")).toStrictEqual({
      message: "There is no block at this height.",
    });
    expect(explainSearchMiss("ab".repeat(32))).toStrictEqual({
      message: "No block or transaction has this ID.",
    });
  });

  it("should ask for the whole ID when given the start of one", () => {
    expect(explainSearchMiss("e5f314fb49a8a2f8").message).toBe(
      "This looks like the start of an ID. Search with the whole ID, 64 characters."
    );
  });

  it("should say a shortened ID, as a wallet shows it, is shortened", () => {
    for (const query of [
      "dc3f73…1c204a",
      "dc3f73...1c204a",
      "DC3F73..1C204A",
    ]) {
      expect(explainSearchMiss(query)).toStrictEqual({
        message:
          "This is a shortened ID. Copy the whole ID, 64 characters, and search again.",
      });
    }
  });

  it("should say a shielded address can't be looked up", () => {
    const shielded = base58.encode(new Uint8Array(64).fill(7));

    expect(explainSearchMiss(shielded).message).toMatch(
      /^This is a shielded address\./
    );
  });

  it("should offer the .dusk name a word could be", () => {
    expect(explainSearchMiss(" Alice ")).toStrictEqual({
      message: "No account, block or transaction matches this.",
      suggestion: "alice.dusk",
    });
    expect(explainSearchMiss("dusk-domains").suggestion).toBe(
      "dusk-domains.dusk"
    );
  });

  it("should say what can be searched for anything else", () => {
    for (const query of ["bad_name", "-alice", "a b"]) {
      expect(explainSearchMiss(query)).toStrictEqual({
        message:
          "Search by account address, block height or hash, transaction ID or .dusk name.",
      });
    }
  });
});
