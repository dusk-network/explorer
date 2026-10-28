import { describe, expect, it } from "vitest";

import { STAKE_CONTRACT, TRANSFER_CONTRACT } from "$lib/network";
import { gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { transactionKind } from "..";

describe("transactionKind", () => {
  const transfer = transformTransaction(gqlTransaction.tx);
  /** @param {string} contract @param {string} method */
  const callTo = (contract, method) => ({
    ...transfer,
    contract,
    method,
    to: null,
  });
  // As the networks' files in @dusk-network/networks have them.
  const bridge = {
    bridge: "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d",
    portal: "14eeb3d4021aff09af2c515603a01f8d956a7f6411d11a1b1c0b0561a93fb1b9",
  };
  const sozu = {
    mainnetPool:
      "6fdfdc713a18fc6ca2ad20eb2b4a3305a935ef47d6a872d9a4df8bc9fd9d169e",
    testnetHub:
      "bae85f8c24730a5a19fbe3d3bd58248ac8c302b62fe414a8c640d8c0ed286b9e",
  };

  it("should tell a public transfer from a shielded one", () => {
    expect(transactionKind(transfer, 2)).toBe("transfer");
    expect(transactionKind({ ...transfer, txtype: "Phoenix" }, 2)).toBe(
      "shielded"
    );
  });

  it("should know the DuskEVM bridge on its own network only", () => {
    const deposit = callTo(bridge.bridge, "depositETHToWithValue");
    const proof = callTo(bridge.portal, "proveWithdrawalTransaction");

    expect(transactionKind(deposit, 2)).toBe("bridge");
    expect(transactionKind(proof, 2)).toBe("bridge");
    expect(transactionKind(deposit, 1)).toBe("call");
    expect(transactionKind(deposit)).toBe("call");
  });

  it("should count native staking and Sozu's pool as staking", () => {
    expect(transactionKind(callTo(STAKE_CONTRACT, "stake"))).toBe("staking");
    expect(transactionKind(callTo(sozu.mainnetPool, "sozu_stake"), 1)).toBe(
      "staking"
    );
    expect(transactionKind(callTo(sozu.testnetHub, "stake_activate"), 2)).toBe(
      "staking"
    );
    expect(transactionKind(callTo(sozu.mainnetPool, "sozu_stake"), 2)).toBe(
      "call"
    );
  });

  it("should call any other contract call, blob or deployment a call", () => {
    expect(transactionKind(callTo(TRANSFER_CONTRACT, "convert"), 2)).toBe(
      "call"
    );
    expect(transactionKind({ ...transfer, method: "blob" }, 2)).toBe("call");
    expect(transactionKind({ ...transfer, method: "deploy" }, 2)).toBe("call");
  });
});
