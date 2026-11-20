import { describe, expect, it } from "vitest";

import { gqlTransaction } from "$lib/mock-data";
import { STAKE_CONTRACT } from "$lib/network";

import { transformTransaction, visibilityOf } from "..";

/**
 * What an explanation of a transaction's privacy says is hidden, and what
 * it says is public: the sentences that say each.
 *
 * @param {string} text
 */
const saidOf = (text) => {
  const sentences = text.split(/\.\s*/);

  return {
    hidden: sentences.filter((s) => /\bhidden\b/i.test(s)).join(". "),
    public: sentences.filter((s) => /\b(public|visible)\b/i.test(s)).join(". "),
  };
};

/*
 * Who sees what of a transaction, as its type's tooltip and its page say:
 * never a public part called hidden, or a hidden one public.
 */
describe("visibilityOf", () => {
  const transfer = transformTransaction(gqlTransaction.tx);
  const shielded = { ...transfer, txtype: "Phoenix" };

  it("should call a public transaction public, everything in it visible", () => {
    const { isPublic, label, seen } = visibilityOf(transfer);

    expect([isPublic, label]).toStrictEqual([true, "Public"]);
    expect(saidOf(seen)).toStrictEqual({
      hidden: "",
      public: expect.stringMatching(/sender.*receiver.*amount/i),
    });
  });

  it("should say what a shielded transfer hides, and what a shielded call still shows", () => {
    const shieldedTransfer = visibilityOf(shielded);
    const withDeposit = visibilityOf({
      ...shielded,
      contract: STAKE_CONTRACT,
      deposit: 1_000_000_000_000,
    });
    const withoutDeposit = visibilityOf({
      ...shielded,
      contract: STAKE_CONTRACT,
      deposit: 0,
    });

    for (const { isPublic, label } of [
      shieldedTransfer,
      withDeposit,
      withoutDeposit,
    ]) {
      expect([isPublic, label]).toStrictEqual([false, "Shielded"]);
    }

    // A transfer: its sender, receiver and amount hidden, nothing public.
    expect(saidOf(shieldedTransfer.seen)).toStrictEqual({
      hidden: expect.stringMatching(/sender.*receiver.*amount/i),
      public: "",
    });

    // A call: its sender hidden, the contract it calls public, and the DUSK
    // it sends that contract when it sends some.
    for (const { seen } of [withDeposit, withoutDeposit]) {
      const said = saidOf(seen);

      expect(said.hidden).toMatch(/sender/i);
      expect(said.hidden).not.toMatch(/contract|DUSK/i);
      expect(said.public).toMatch(/contract/i);
    }
    expect(saidOf(withDeposit.seen).public).toMatch(/DUSK/);
    expect(withoutDeposit.seen).not.toMatch(/DUSK/);
  });
});
