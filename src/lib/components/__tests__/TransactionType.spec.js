import { afterEach, describe, expect, it, vi } from "vitest";
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

  it.each([
    ["Sent", "out"],
    ["Received", "in"],
    ["Sent to itself", "self"],
  ])(
    "should say a transfer was %s, for the account whose page lists it",
    (words, direction) => {
      const { getByText } = render(TransactionType, {
        props: {
          data: transaction,
          direction: /** @type {"in" | "out" | "self"} */ (direction),
        },
      });

      expect(getByText(words)).toHaveClass("transaction-type__direction");
    }
  );

  it("should keep a call's own words, its way shown by the row's sign", async () => {
    const { container, queryByText } = render(TransactionType, {
      props: {
        data: {
          ...transaction,
          contract:
            "0200000000000000000000000000000000000000000000000000000000000000",
          method: "withdraw",
          to: null,
        },
        direction: "out",
      },
    });

    await vi.waitFor(() =>
      expect(
        container.querySelector(".transaction-type__label")
      ).toHaveTextContent("Claim rewards")
    );
    expect(queryByText("Sent")).toBeNull();
  });
});
