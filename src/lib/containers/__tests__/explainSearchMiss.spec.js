import { describe, expect, it } from "vitest";
import { encodeBase58 } from "@dusk-network/networks/account";

import explainSearchMiss from "../search-field/explainSearchMiss";

describe("explainSearchMiss", () => {
  it("should say there is no such block or transaction", () => {
    expect(explainSearchMiss("99999999")).toStrictEqual({
      message: "No block at this height yet",
    });
    expect(explainSearchMiss("ab".repeat(32))).toStrictEqual({
      message: "No block or transaction with this ID",
    });
  });

  it("should ask for the whole ID when given the start of one", () => {
    expect(explainSearchMiss("e5f314fb49a8a2f8").message).toBe(
      "Partial ID: search with all 64 characters",
    );
  });

  it("should say a shortened ID, as a wallet shows it, is shortened", () => {
    for (const query of [
      "dc3f73…1c204a",
      "dc3f73...1c204a",
      "DC3F73..1C204A",
    ]) {
      expect(explainSearchMiss(query)).toStrictEqual({
        message: "Shortened ID: search with all 64 characters",
      });
    }
  });

  it("should say a shielded address can't be looked up", () => {
    const shielded = encodeBase58(new Uint8Array(64).fill(7));

    expect(explainSearchMiss(shielded).message).toBe(
      "Shielded address: its balance and transfers are private",
    );
  });

  it("should offer the .dusk name a word could be, and add no words to the notice's heading", () => {
    expect(explainSearchMiss(" Alice ")).toStrictEqual({
      message: "",
      suggestion: "alice.dusk",
    });
    expect(explainSearchMiss("dusk-domains").suggestion).toBe(
      "dusk-domains.dusk",
    );
    // A subname, and a name typed with its dot but not its ending.
    expect(explainSearchMiss("pay.alice").suggestion).toBe("pay.alice.dusk");
    expect(explainSearchMiss("alice.").suggestion).toBe("alice.dusk");
  });

  it("should say what can be searched for anything else", () => {
    for (const query of ["bad_name", "-alice", "a b", "0x12ab"]) {
      expect(explainSearchMiss(query)).toStrictEqual({
        message:
          "Try an account, block height or hash, transaction ID or .dusk name",
      });
    }
  });
});
