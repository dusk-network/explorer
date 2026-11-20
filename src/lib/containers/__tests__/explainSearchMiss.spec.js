import { describe, expect, it } from "vitest";
import { encodeBase58 } from "@dusk-network/networks/account";

import explainSearchMiss from "../search-field/explainSearchMiss";

/*
 * The words of each explanation are copy: these check which kind of miss a
 * query is, and the .dusk name it suggests.
 */
describe("explainSearchMiss", () => {
  const shielded = encodeBase58(new Uint8Array(64).fill(7));

  it("should tell each kind of miss apart, suggesting no name for them", () => {
    const misses = [
      "99999999", // a height past the last block
      "ab".repeat(32), // a whole ID that nothing has
      "e5f314fb49a8a2f8", // the start of an ID
      "dc3f73…1c204a", // an ID as a wallet shortens it
      shielded, // a shielded address
      "bad_name", // anything else
    ].map(explainSearchMiss);

    for (const miss of misses) {
      expect(miss).toStrictEqual({ message: expect.any(String) });
    }

    expect(new Set(misses.map(({ message }) => message)).size).toBe(
      misses.length,
    );
  });

  it("should take a shortened ID however it is written", () => {
    for (const query of ["dc3f73...1c204a", "DC3F73..1C204A"]) {
      expect(explainSearchMiss(query)).toStrictEqual(
        explainSearchMiss("dc3f73…1c204a"),
      );
    }
  });

  it("should offer the .dusk name a word could be", () => {
    expect(explainSearchMiss(" Alice ").suggestion).toBe("alice.dusk");
    expect(explainSearchMiss("dusk-domains").suggestion).toBe(
      "dusk-domains.dusk",
    );
    // A subname, and a name typed with its dot but not its ending.
    expect(explainSearchMiss("pay.alice").suggestion).toBe("pay.alice.dusk");
    expect(explainSearchMiss("alice.").suggestion).toBe("alice.dusk");
  });

  it("should give anything else one explanation, and no name", () => {
    for (const query of ["-alice", "a b", "0x12ab"]) {
      expect(explainSearchMiss(query)).toStrictEqual(
        explainSearchMiss("bad_name"),
      );
    }
  });
});
