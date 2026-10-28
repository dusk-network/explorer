import { describe, expect, it } from "vitest";

import { STAKE_CONTRACT, TRANSFER_CONTRACT } from "$lib/constants";
import { gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { DUSKEVM_BRIDGE_CONTRACTS, SOZU_CONTRACTS, transactionKind } from "..";

describe("transactionKind", () => {
  const transfer = transformTransaction(gqlTransaction.tx);
  /** @param {string} contract @param {string} method */
  const callTo = (contract, method) => ({
    ...transfer,
    contract,
    method,
    to: null,
  });
  const bridge = /** @type {{ bridge: string, portal: string }} */ (
    DUSKEVM_BRIDGE_CONTRACTS.testnet
  );

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
    expect(
      transactionKind(callTo(SOZU_CONTRACTS.mainnet.pool, "sozu_stake"), 1)
    ).toBe("staking");
    expect(
      transactionKind(callTo(SOZU_CONTRACTS.testnet.hub, "stake_activate"), 2)
    ).toBe("staking");
  });

  it("should call any other contract call, blob or deployment a call", () => {
    expect(transactionKind(callTo(TRANSFER_CONTRACT, "convert"), 2)).toBe(
      "call"
    );
    expect(transactionKind({ ...transfer, method: "blob" }, 2)).toBe("call");
    expect(transactionKind({ ...transfer, method: "deploy" }, 2)).toBe("call");
  });
});
