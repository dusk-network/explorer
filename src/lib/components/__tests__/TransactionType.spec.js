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

  it("should call a transaction that carries blobs a data blob", async () => {
    const { container } = render(TransactionType, {
      props: {
        data: { ...transaction, blobHashes: ["ab".repeat(32)], method: "blob" },
        showPrivacy: false,
      },
    });

    await vi.waitFor(() =>
      expect(
        container.querySelector(".transaction-type__label")
      ).toHaveTextContent(/^Data blob$/)
    );
  });

  it("should show the function a call ran, unless its words already say it", async () => {
    const contract =
      "590429da249cbb6f0a680e1d5f6ecdc885912fc836589c38bb8fd5e6ea4f722c";
    const stake =
      "0200000000000000000000000000000000000000000000000000000000000000";
    const words = async (/** @type {Partial<Transaction>} */ call) => {
      cleanup();

      const { container } = render(TransactionType, {
        props: { data: { ...transaction, ...call }, showPrivacy: false },
      });

      await vi.waitFor(() =>
        expect(
          container.querySelector(".transaction-type__label")
        ).toBeInTheDocument()
      );

      return [
        container.querySelector(".transaction-type__label")?.textContent,
        container.querySelector(".transaction-type__method")?.textContent,
      ];
    };

    expect(await words({ contract, method: "schedule" })).toStrictEqual([
      "Contract call",
      "schedule",
    ]);
    expect(await words({ contract: stake, method: "stake" })).toStrictEqual([
      "Stake",
      undefined,
    ]);
    expect(await words({ contract: stake, method: "withdraw" })).toStrictEqual([
      "Claim rewards",
      "withdraw",
    ]);
    expect(
      await words({ contract: undefined, method: "transfer" })
    ).toStrictEqual(["Transfer", undefined]);
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
