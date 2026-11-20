import { describe, expect, it } from "vitest";

import { gqlTransaction } from "$lib/mock-data";
import { STAKE_CONTRACT } from "$lib/network";

import { describeTransaction, transformTransaction } from "..";

/*
 * The sentence's words are copy: these check whom it names, in which order,
 * and the amount, every decimal of it.
 */
describe("describeTransaction", () => {
  const transfer = transformTransaction(gqlTransaction.tx);
  const names = { from: "alice.dusk", to: "bob.dusk" };

  it("should say who sent how much to whom, every decimal of it", () => {
    expect(describeTransaction(transfer, names)).toMatch(
      /^alice\.dusk .* 9,812\.378912731 DUSK .* bob\.dusk$/,
    );
    expect(
      describeTransaction({ ...transfer, amount: 500_000_000 }, names),
    ).toMatch(/^alice\.dusk .* 0\.5 DUSK .* bob\.dusk$/);
  });

  it("should say a deposit to DuskEVM goes to the DuskEVM address it names", () => {
    const deposit = {
      ...transfer,
      amount: 0,
      contract: "2257e5f8".padEnd(64, "0"),
      deposit: 500_000_000,
      method: "depositETHToWithValue",
      to: null,
    };
    const toAddress = describeTransaction(deposit, {
      duskEvm: "0x5A3d…8a01",
      from: "alice.dusk",
      to: "DuskEVM bridge",
    });

    expect(toAddress).toMatch(/^alice\.dusk .* 0\.5 DUSK .* 0x5A3d…8a01\b/);
    expect(toAddress).not.toContain("DuskEVM bridge");
    expect(
      describeTransaction(deposit, {
        from: "alice.dusk",
        to: "DuskEVM bridge",
      }),
    ).toMatch(/^alice\.dusk .* 0\.5 DUSK .* DuskEVM bridge$/);
  });

  it("should say that the sender of a transaction that failed only tried to send", () => {
    const failed = { ...transfer, txerror: "Panic" };
    const deposit = { duskEvm: "0x5A3d…8a01", from: "alice.dusk", to: null };

    // The same parties and amount, not in the words of one that went through.
    expect(describeTransaction(failed, names)).toMatch(
      /^alice\.dusk .* 9,812\.378912731 DUSK .* bob\.dusk$/,
    );
    expect(describeTransaction(failed, names)).not.toBe(
      describeTransaction(transfer, names),
    );
    expect(
      describeTransaction({ ...failed, amount: 500_000_000 }, deposit),
    ).not.toBe(
      describeTransaction({ ...transfer, amount: 500_000_000 }, deposit),
    );
  });

  it("should say which method a call without DUSK called, on which contract", () => {
    const call = {
      ...transfer,
      amount: 0,
      contract: "01".padEnd(64, "0"),
      deposit: 0,
      method: "convert",
      to: null,
    };
    const sentence = describeTransaction(call, {
      from: "alice.dusk",
      to: "Transfer contract",
    });

    expect(sentence).toMatch(/^alice\.dusk .*\bconvert\b.* Transfer contract$/);
    expect(sentence).not.toContain("DUSK");
  });

  it("should say what a shielded transaction hides", () => {
    // No amount, no account, and nothing in their place that reads as one.
    expect(
      describeTransaction(
        {
          ...transfer,
          amount: undefined,
          from: undefined,
          to: undefined,
          txtype: "Phoenix",
        },
        { from: null, to: null },
      ),
    ).not.toMatch(/\d|DUSK|undefined|null|NaN/);
  });

  it("should say a deployment deployed a contract", () => {
    const sentence = describeTransaction(
      { ...transfer, method: "deploy", to: null },
      names,
    );

    expect(sentence).toMatch(/^alice\.dusk /);
    expect(sentence).not.toMatch(/DUSK|bob\.dusk/);
  });

  it("should say what a call to the stake contract did, and how much a stake staked", () => {
    const call = {
      ...transfer,
      amount: 0,
      contract: STAKE_CONTRACT,
      deposit: 0,
      to: null,
    };
    /** @param {Partial<Transaction>} tx */
    const said = (tx) =>
      describeTransaction(
        { ...call, ...tx },
        { from: "alice.dusk", to: "Stake contract" },
      );
    const stake = said({ deposit: 442_409_461_511, method: "stake" });
    const unstake = said({ method: "unstake" });
    const claim = said({ method: "withdraw" });

    expect(stake).toMatch(/^alice\.dusk .* 442\.409461511 DUSK$/);
    // An unstake and a reward claim send no DUSK. Each reads as its own, in
    // plain words rather than as a call on the contract.
    for (const sentence of [unstake, claim]) {
      expect(sentence).toMatch(/^alice\.dusk /);
      expect(sentence).not.toMatch(/DUSK|Stake contract|withdraw\b/);
    }
    expect(new Set([stake, unstake, claim]).size).toBe(3);

    // One that failed staked nothing: not in the words of one that did.
    const tried = { deposit: 1_000_000_000_000, method: "stake" };

    expect(said({ ...tried, txerror: "Panic" })).toMatch(
      /^alice\.dusk .* 1,000 DUSK$/,
    );
    expect(said({ ...tried, txerror: "Panic" })).not.toBe(said(tried));

    // A shielded claim hides who claimed, and sends no DUSK to hide.
    expect(
      said({
        amount: undefined,
        from: undefined,
        method: "withdraw",
        txtype: "Phoenix",
      }),
    ).not.toMatch(/alice\.dusk|\d|DUSK/);
  });
});
