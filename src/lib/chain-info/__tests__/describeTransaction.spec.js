import { describe, expect, it } from "vitest";

import { gqlTransaction } from "$lib/mock-data";

import { describeTransaction, transformTransaction } from "..";

describe("describeTransaction", () => {
  const transfer = transformTransaction(gqlTransaction.tx);
  const names = { from: "alice.dusk", to: "bob.dusk" };

  it("should say who sent how much to whom, every decimal of it", () => {
    expect(describeTransaction(transfer, names)).toBe(
      "alice.dusk sent 9,812.378912731 DUSK to bob.dusk"
    );
    expect(
      describeTransaction({ ...transfer, amount: 500_000_000 }, names)
    ).toBe("alice.dusk sent 0.5 DUSK to bob.dusk");
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

    expect(
      describeTransaction(deposit, {
        duskEvm: "0x5A3d…8a01",
        from: "alice.dusk",
        to: "DuskEVM bridge",
      })
    ).toBe("alice.dusk sent 0.5 DUSK to 0x5A3d…8a01 on DuskEVM");
    expect(
      describeTransaction(deposit, { from: "alice.dusk", to: "DuskEVM bridge" })
    ).toBe("alice.dusk sent 0.5 DUSK to DuskEVM bridge");
  });

  it("should say that the sender of a transaction that failed only tried to send", () => {
    const failed = { ...transfer, txerror: "Panic" };

    expect(describeTransaction(failed, names)).toBe(
      "alice.dusk tried to send 9,812.378912731 DUSK to bob.dusk"
    );
    expect(
      describeTransaction(
        { ...failed, amount: 500_000_000 },
        { duskEvm: "0x5A3d…8a01", from: "alice.dusk", to: null }
      )
    ).toBe("alice.dusk tried to send 0.5 DUSK to 0x5A3d…8a01 on DuskEVM");
  });

  it("should say which method a call without DUSK called, on which contract", () => {
    const call = {
      ...transfer,
      amount: 0,
      contract: "02".padEnd(64, "0"),
      deposit: 0,
      method: "withdraw",
      to: null,
    };

    expect(
      describeTransaction(call, { from: "alice.dusk", to: "Stake contract" })
    ).toBe("alice.dusk called withdraw on Stake contract");
  });

  it("should say what a shielded transaction hides", () => {
    expect(
      describeTransaction(
        {
          ...transfer,
          amount: undefined,
          from: undefined,
          to: undefined,
          txtype: "Phoenix",
        },
        { from: null, to: null }
      )
    ).toBe("A shielded account sent a hidden amount to a shielded account");
  });

  it("should say a deployment deployed a contract", () => {
    expect(
      describeTransaction({ ...transfer, method: "deploy", to: null }, names)
    ).toBe("alice.dusk deployed a contract");
  });
});
