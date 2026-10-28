import { describe, expect, it } from "vitest";

import { gqlTransaction } from "$lib/mock-data";

import { accountsOf, summarizeTransaction, transformTransaction } from "..";

describe("summarizeTransaction", () => {
  const transfer = transformTransaction(gqlTransaction.tx);
  const stake =
    "0200000000000000000000000000000000000000000000000000000000000000";

  it("should give a public transfer's sender, receiver and value", () => {
    expect(summarizeTransaction(transfer)).toStrictEqual({
      amount: { kind: "value", lux: transfer.amount },
      from: { address: transfer.from, kind: "account" },
      to: { address: transfer.to, kind: "account" },
    });
  });

  it("should give a contract call's contract and the deposit it sends", () => {
    const call = {
      ...transfer,
      amount: 0,
      contract: stake,
      deposit: 1_000_000_000_000,
      to: undefined,
    };

    expect(summarizeTransaction(call)).toStrictEqual({
      amount: { kind: "deposit", lux: 1_000_000_000_000 },
      from: { address: transfer.from, kind: "account" },
      to: { id: stake, kind: "contract" },
    });
    expect(summarizeTransaction({ ...call, deposit: 0 }).amount).toStrictEqual({
      kind: "value",
      lux: 0,
    });
  });

  it("should give a public transfer to its own sender that sender as the receiver", () => {
    // The node leaves the receiver out when it is the sender.
    const toSelf = { ...transfer, to: null };

    expect(summarizeTransaction(toSelf)).toStrictEqual({
      amount: { kind: "value", lux: transfer.amount },
      from: { address: transfer.from, kind: "account" },
      to: { address: transfer.from, kind: "account" },
    });
    // Also when it calls a contract on the way: the value goes to the sender.
    expect(
      summarizeTransaction({ ...toSelf, contract: stake, deposit: 5 }).to
    ).toStrictEqual({ address: transfer.from, kind: "account" });
    // Without a value, the call's contract is where it went.
    expect(
      summarizeTransaction({ ...toSelf, amount: 0, contract: stake }).to
    ).toStrictEqual({ id: stake, kind: "contract" });
  });

  it("should say what a shielded transaction hides, but not its deposit", () => {
    const shielded = {
      ...transfer,
      amount: undefined,
      from: undefined,
      to: undefined,
      txtype: "Phoenix",
    };

    expect(summarizeTransaction(shielded)).toStrictEqual({
      amount: { kind: "shielded" },
      from: { kind: "shielded" },
      to: { kind: "shielded" },
    });
    expect(
      summarizeTransaction({ ...shielded, contract: stake, deposit: 5 })
    ).toStrictEqual({
      amount: { kind: "deposit", lux: 5 },
      from: { kind: "shielded" },
      to: { id: stake, kind: "contract" },
    });
  });

  it("should give no receiver when a public transaction has none", () => {
    const deploy = {
      ...transfer,
      amount: 0,
      contract: undefined,
      method: "deploy",
      to: null,
    };

    expect(summarizeTransaction(deploy).to).toBeNull();
  });

  it("should send a call that moves no value to its contract, not to a named receiver", () => {
    const call = {
      ...transfer,
      amount: 0,
      contract: stake,
      deposit: 7,
      method: "stake",
    };

    expect(summarizeTransaction(call)).toStrictEqual({
      amount: { kind: "deposit", lux: 7 },
      from: { address: transfer.from, kind: "account" },
      to: { id: stake, kind: "contract" },
    });
  });

  it("should give a zero-value transfer to its own sender that sender as the receiver", () => {
    const toSelf = { ...transfer, amount: 0, method: "transfer", to: null };

    expect(summarizeTransaction(toSelf)).toStrictEqual({
      amount: { kind: "value", lux: 0 },
      from: { address: transfer.from, kind: "account" },
      to: { address: transfer.from, kind: "account" },
    });
  });
});

describe("accountsOf", () => {
  const transfer = transformTransaction(gqlTransaction.tx);
  const stake =
    "0200000000000000000000000000000000000000000000000000000000000000";

  it("should give each account a From or To shows, once", () => {
    const back = { ...transfer, from: transfer.to ?? "", to: transfer.from };

    expect(accountsOf([transfer, back])).toStrictEqual([
      transfer.from,
      transfer.to,
    ]);
  });

  it("should leave out a receiver the summary replaces with the contract", () => {
    const call = { ...transfer, amount: 0, contract: stake, deposit: 7 };

    expect(accountsOf([call])).toStrictEqual([transfer.from]);
  });
});
