import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { TransactionType } from "..";

describe("TransactionType", () => {
  const transaction = transformTransaction(gqlTransaction.tx);

  afterEach(cleanup);

  it.each([
    ["Moonlight", "Public"],
    ["Phoenix", "Shielded"],
  ])("should say in words that a %s transaction is %s", (txtype, label) => {
    const { getByText } = render(TransactionType, {
      props: { data: { ...transaction, txtype } },
    });

    expect(getByText(label)).toHaveClass("transaction-type__privacy");
  });

  it("should say what a shielded call hides, and what it shows", () => {
    const shielded = { ...transaction, txtype: "Phoenix" };
    const stake =
      "0200000000000000000000000000000000000000000000000000000000000000";
    const privacy = (/** @type {Transaction} */ data) => {
      cleanup();

      return render(TransactionType, { props: { data, displayTooltips: true } })
        .getByText("Shielded")
        .getAttribute("data-tooltip-text");
    };

    expect(privacy(shielded)).toBe("Sender, receiver and amount are hidden");
    expect(
      privacy({ ...shielded, contract: stake, deposit: 1_000_000_000_000 })
    ).toBe(
      "Sender and value are hidden. The contract called and the DUSK sent to it are public"
    );
    expect(privacy({ ...shielded, contract: stake, deposit: 0 })).toBe(
      "Sender and value are hidden. The contract called is public"
    );
  });
});
