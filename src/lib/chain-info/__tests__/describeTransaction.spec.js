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
    // It went through: sent.
    expect(describeTransaction(transfer, names)).toMatch(/\bsent\b/);
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

    expect(toAddress).toMatch(
      /^alice\.dusk .* 0\.5 DUSK .* 0x5A3d…8a01 on DuskEVM$/,
    );
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
    const toDuskEvm = describeTransaction(
      { ...failed, amount: 500_000_000 },
      { duskEvm: "0x5A3d…8a01", from: "alice.dusk", to: null },
    );

    // The same parties and amount: only tried, never sent or paid.
    expect(describeTransaction(failed, names)).toMatch(
      /^alice\.dusk .* 9,812\.378912731 DUSK .* bob\.dusk$/,
    );
    expect(describeTransaction(failed, names)).toMatch(/\btried\b/);
    expect(describeTransaction(failed, names)).not.toMatch(/\b(sent|paid)\b/i);
    expect(toDuskEvm).toMatch(
      /^alice\.dusk .* 0\.5 DUSK .* 0x5A3d…8a01 on DuskEVM$/,
    );
    expect(toDuskEvm).toMatch(/\btried\b/);
    expect(toDuskEvm).not.toMatch(/\b(sent|paid)\b/i);
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
    const sentence = describeTransaction(
      {
        ...transfer,
        amount: undefined,
        from: undefined,
        to: undefined,
        txtype: "Phoenix",
      },
      { from: null, to: null },
    );

    // Shielded, never public, and nothing in place of an account or an
    // amount that reads as one.
    expect(sentence).toMatch(/\bshielded\b/i);
    expect(sentence).not.toMatch(/\bpublic\b/i);
    expect(sentence).not.toMatch(/\d|DUSK|undefined|null|NaN/);
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
    // It went through: staked.
    expect(stake).toMatch(/\bstaked\b/);
    // An unstake and a reward claim send no DUSK, each its own action, in
    // plain words rather than as a call on the contract.
    expect(unstake).toMatch(/^alice\.dusk .*\bunstake/i);
    expect(unstake).not.toMatch(/claim/i);
    expect(claim).toMatch(/^alice\.dusk .*\bclaim/i);
    expect(claim).not.toMatch(/unstake/i);
    for (const sentence of [unstake, claim]) {
      expect(sentence).not.toMatch(/DUSK|Stake contract|withdraw\b/);
    }

    // One that failed staked nothing: it only tried.
    const tried = said({
      deposit: 1_000_000_000_000,
      method: "stake",
      txerror: "Panic",
    });

    expect(tried).toMatch(/^alice\.dusk .* 1,000 DUSK$/);
    expect(tried).toMatch(/\btried\b/);
    expect(tried).not.toMatch(/\b(staked|sent|paid)\b/i);

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
